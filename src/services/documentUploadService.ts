import { supabase } from '@/lib/supabase';
import { validateFileUpload, sanitizeFilename } from '../utils/validation';
import { DocumentProcessingPipeline, ProcessingStatus } from './documentProcessingPipeline';

export interface UploadProgress {
  stage: 'validating' | 'uploading' | 'creating_record' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  error?: string;
}

export interface UploadResult {
  success: boolean;
  documentId?: string;
  title?: string;
  error?: string;
  processingStarted?: boolean;
}

export class DocumentUploadService {
  private pipeline = new DocumentProcessingPipeline();

  /**
   * Upload document and optionally trigger automatic processing
   */
  async uploadDocument(
    file: File,
    masterName: string,
    title: string,
    options: {
      autoProcess?: boolean;
      youtubeUrl?: string;
      onProgress?: (progress: UploadProgress) => void;
    } = {}
  ): Promise<UploadResult> {
    const { autoProcess = true, youtubeUrl, onProgress } = options;

    try {
      // Stage 1: Validate file
      onProgress?.({
        stage: 'validating',
        progress: 0,
        message: 'Validating file...'
      });

      const validation = validateFileUpload(file, {
        maxSizeMB: 50,
        allowedTypes: ['application/pdf', 'application/epub+zip', 'text/plain']
      });

      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Look up master_id from master name
      const { data: master, error: masterError } = await supabase
        .from('legalrnd_masters')
        .select('id')
        .eq('name', masterName)
        .single();

      if (masterError || !master) {
        throw new Error(`Master "${masterName}" not found in database`);
      }

      // Stage 2: Upload to storage
      onProgress?.({
        stage: 'uploading',
        progress: 20,
        message: 'Uploading file to storage...'
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeFilename = sanitizeFilename(file.name);
      const fileName = `${timestamp}_${safeFilename}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('legalrnd-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log(`✅ File uploaded to: ${filePath}`);

      // Stage 3: Create document record
      onProgress?.({
        stage: 'creating_record',
        progress: 40,
        message: 'Creating document record...'
      });

      const fileType = this.getFileType(file);

      // Extract YouTube video ID if URL provided
      const youtubeVideoId = youtubeUrl ? this.extractYouTubeVideoId(youtubeUrl) : null;

      const { data: doc, error: docError } = await supabase
        .from('legalrnd_documents')
        .insert({
          title,
          author_master_id: master.id,
          file_path: filePath,
          file_type: fileType,
          file_size_bytes: file.size,
          processed: false,
          processing_status: 'pending',
          upload_date: new Date().toISOString(),
          youtube_url: youtubeUrl || null,
          youtube_video_id: youtubeVideoId
        })
        .select()
        .single();

      if (docError) {
        // Cleanup: delete uploaded file
        await supabase.storage
          .from('legalrnd-documents')
          .remove([filePath]);

        throw new Error(`Failed to create document record: ${docError.message}`);
      }

      console.log(`✅ Document record created: ${doc.id}`);

      // Stage 4: Trigger processing (if enabled)
      let processingStarted = false;

      if (autoProcess) {
        onProgress?.({
          stage: 'processing',
          progress: 60,
          message: 'Starting document processing...'
        });

        // Start processing in background (don't await)
        this.pipeline.processDocument(doc.id, (status: ProcessingStatus) => {
          onProgress?.({
            stage: 'processing',
            progress: 60 + (status.progress * 0.4), // Map 0-100 to 60-100
            message: status.message,
            error: status.error
          });
        }).then(result => {
          if (result.success) {
            console.log(`✅ Document processed: ${result.chunkCount} chunks created`);
          } else {
            console.error(`❌ Processing failed: ${result.error}`);
          }
        });

        processingStarted = true;
      }

      // Stage 5: Complete
      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: autoProcess
          ? 'Upload complete! Processing started in background.'
          : 'Upload complete! Processing can be started manually.'
      });

      return {
        success: true,
        documentId: doc.id,
        title: doc.title,
        processingStarted
      };
    } catch (error) {
      console.error('Upload error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      onProgress?.({
        stage: 'error',
        progress: 0,
        message: 'Upload failed',
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get file type from File object
   */
  private getFileType(file: File): string {
    // Try MIME type first
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type === 'application/epub+zip') return 'epub';
    if (file.type === 'text/plain') return 'txt';

    // Fallback to file extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') return 'pdf';
    if (extension === 'epub') return 'epub';
    if (extension === 'txt') return 'txt';
    if (extension === 'docx') return 'docx';

    return 'pdf'; // Default
  }

  /**
   * Get all documents with master info
   */
  async getDocuments(): Promise<any[]> {
    const { data, error } = await supabase
      .from('legalrnd_documents')
      .select(`
        *,
        legalrnd_masters(name)
      `)
      .order('upload_date', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get documents by master
   */
  async getDocumentsByMaster(masterName: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('legalrnd_documents')
      .select(`
        *,
        legalrnd_masters!inner(name)
      `)
      .eq('legalrnd_masters.name', masterName)
      .order('upload_date', { ascending: false });

    if (error) {
      console.error('Error fetching documents by master:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<any> {
    const { data, error } = await supabase
      .from('legalrnd_documents')
      .select(`
        *,
        legalrnd_masters(name)
      `)
      .eq('id', documentId)
      .single();

    if (error) {
      console.error('Error fetching document:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete document and all associated chunks
   */
  async deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Fetch document to get file path
      const { data: doc, error: fetchError } = await supabase
        .from('legalrnd_documents')
        .select('file_path')
        .eq('id', documentId)
        .single();

      if (fetchError || !doc) {
        throw new Error('Document not found');
      }

      // Delete chunks first (foreign key dependency)
      const { error: chunksError } = await supabase
        .from('hfnai_document_chunks')
        .delete()
        .eq('document_id', documentId);

      if (chunksError) {
        console.warn('Error deleting chunks:', chunksError);
      }

      // Delete document record
      const { error: docError } = await supabase
        .from('legalrnd_documents')
        .delete()
        .eq('id', documentId);

      if (docError) {
        throw new Error(`Failed to delete document: ${docError.message}`);
      }

      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('legalrnd-documents')
        .remove([doc.file_path]);

      if (storageError) {
        console.warn('Error deleting file from storage:', storageError);
      }

      return { success: true };
    } catch (error) {
      console.error('Delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Manually trigger processing for a document
   */
  async processDocument(
    documentId: string,
    onProgress?: (status: ProcessingStatus) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.pipeline.processDocument(documentId, onProgress);

      return {
        success: result.success,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats() {
    return this.pipeline.getProcessingStats();
  }

  /**
   * Extract YouTube video ID from URL
   */
  private extractYouTubeVideoId(url: string): string | null {
    if (!url) return null;

    const patterns = [
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }
}
