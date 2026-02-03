import { supabase } from '../lib/supabase';
import { TextExtractionService } from './textExtractionService';
import { ChunkingService, TextChunk } from './chunkingService';
import { EmbeddingService } from './embeddingService';

export interface ProcessingStatus {
  stage: 'extraction' | 'chunking' | 'embedding' | 'storage' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  error?: string;
}

export interface ProcessingResult {
  success: boolean;
  documentId: string;
  chunkCount: number;
  extractionMethod: string;
  confidence: number;
  totalTokens: number;
  error?: string;
}

export class DocumentProcessingPipeline {
  private textExtractor = new TextExtractionService();
  private chunker = new ChunkingService();
  private embedder = new EmbeddingService();

  /**
   * Main pipeline - processes a document from upload to vector storage
   */
  async processDocument(
    documentId: string,
    onProgress?: (status: ProcessingStatus) => void
  ): Promise<ProcessingResult> {
    try {
      // Fetch document metadata
      onProgress?.({
        stage: 'extraction',
        progress: 0,
        message: 'Fetching document metadata...'
      });

      const { data: document, error: fetchError } = await supabase
        .from('hfnai_documents')
        .select('*, hfnai_masters(name)')
        .eq('id', documentId)
        .single();

      if (fetchError || !document) {
        throw new Error(`Document not found: ${fetchError?.message}`);
      }

      // Update status to processing
      await this.updateDocumentStatus(documentId, 'processing');

      // Stage 1: Extract text
      onProgress?.({
        stage: 'extraction',
        progress: 10,
        message: `Reading document... (estimated 30 seconds)`
      });

      const extractionResult = await this.textExtractor.extractText(
        document.file_path,
        document.file_type
      );

      console.log(`Extracted ${extractionResult.charCount} characters using ${extractionResult.extractionMethod}`);

      // Update document with extraction results
      await supabase
        .from('hfnai_documents')
        .update({
          full_text: extractionResult.fullText,
          page_count: extractionResult.pageCount,
          extraction_method: extractionResult.extractionMethod,
          extraction_confidence: extractionResult.confidence
        })
        .eq('id', documentId);

      // Stage 2: Chunk text
      onProgress?.({
        stage: 'chunking',
        progress: 30,
        message: `Analyzing content structure... (${extractionResult.pageCount} pages)`
      });

      const chunks = this.chunker.chunkText(
        extractionResult.fullText,
        extractionResult.pageCount,
        document.title,
        extractionResult.timestampMappings,
        extractionResult.pageMappings
      );

      console.log(`Created ${chunks.length} chunks`);

      // Validate chunks
      const validChunks = chunks.filter(chunk => {
        const validation = this.chunker.validateChunk(chunk);
        if (!validation.valid) {
          console.warn(`Skipping invalid chunk ${chunk.chunkIndex}: ${validation.reason}`);
        }
        return validation.valid;
      });

      console.log(`${validChunks.length} valid chunks after validation`);

      // Stage 3: Generate embeddings
      const estimatedMinutes = Math.ceil(validChunks.length / 20); // ~20 chunks per minute
      onProgress?.({
        stage: 'embedding',
        progress: 50,
        message: `Processing ${validChunks.length} sections... (about ${estimatedMinutes} ${estimatedMinutes === 1 ? 'minute' : 'minutes'})`
      });

      const chunkTexts = validChunks.map(chunk =>
        this.chunker.addChunkContext(
          chunk,
          document.title,
          document.hfnai_masters?.name
        )
      );

      const embeddingResult = await this.embedder.generateBatchEmbeddings(chunkTexts);

      console.log(`Generated embeddings using ${embeddingResult.totalTokens} tokens`);

      // Stage 4: Store chunks with embeddings
      onProgress?.({
        stage: 'storage',
        progress: 80,
        message: 'Finalizing... (almost done!)'
      });

      const storedCount = await this.storeChunksWithEmbeddings(
        documentId,
        validChunks,
        embeddingResult.embeddings
      );

      console.log(`Stored ${storedCount} chunks in database`);

      // Stage 5: Mark as completed
      await this.updateDocumentStatus(documentId, 'completed');

      // Update processed timestamp (chunk_count removed - not in schema)
      await supabase
        .from('hfnai_documents')
        .update({
          processed_at: new Date().toISOString()
        })
        .eq('id', documentId);

      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: `Processing complete! ${storedCount} chunks ready for search.`
      });

      return {
        success: true,
        documentId,
        chunkCount: storedCount,
        extractionMethod: extractionResult.extractionMethod,
        confidence: extractionResult.confidence,
        totalTokens: embeddingResult.totalTokens
      };
    } catch (error) {
      console.error('Document processing error:', error);

      // Mark document as failed
      await this.updateDocumentStatus(documentId, 'failed');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      onProgress?.({
        stage: 'failed',
        progress: 0,
        message: 'Processing failed',
        error: errorMessage
      });

      return {
        success: false,
        documentId,
        chunkCount: 0,
        extractionMethod: 'none',
        confidence: 0,
        totalTokens: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Store chunks with embeddings in Supabase
   */
  private async storeChunksWithEmbeddings(
    documentId: string,
    chunks: TextChunk[],
    embeddings: number[][]
  ): Promise<number> {
    if (chunks.length !== embeddings.length) {
      throw new Error('Chunk count and embedding count mismatch');
    }

    // Prepare chunk records
    const chunkRecords = chunks.map((chunk, index) => ({
      document_id: documentId,
      content: chunk.content,
      chunk_index: chunk.chunkIndex,
      page_number: chunk.pageNumber,
      token_count: chunk.tokenCount,
      embedding: JSON.stringify(embeddings[index]), // Supabase expects array as JSON
      start_timestamp: chunk.startTimestamp,
      end_timestamp: chunk.endTimestamp,
      created_at: new Date().toISOString()
    }));

    // Insert in batches of 50 to avoid payload limits
    const batchSize = 50;
    let totalInserted = 0;

    for (let i = 0; i < chunkRecords.length; i += batchSize) {
      const batch = chunkRecords.slice(i, i + batchSize);

      const { error } = await supabase
        .from('hfnai_document_chunks')
        .insert(batch)
        .select();

      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
        throw new Error(`Failed to store chunks: ${error.message}`);
      }

      totalInserted += batch.length;
      console.log(`Inserted batch ${i / batchSize + 1}: ${batch.length} chunks (${totalInserted}/${chunkRecords.length})`);
    }

    return totalInserted;
  }

  /**
   * Update document processing status
   */
  private async updateDocumentStatus(
    documentId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    const updateData: any = { processing_status: status };

    // Only update 'processed' boolean flag when completed
    if (status === 'completed' || status === 'failed') {
      updateData.processed = status === 'completed';
    }

    const { error } = await supabase
      .from('hfnai_documents')
      .update(updateData)
      .eq('id', documentId);

    if (error) {
      console.error('Error updating document status:', error);
    }
  }

  /**
   * Process all pending documents
   */
  async processPendingDocuments(
    onProgress?: (documentId: string, status: ProcessingStatus) => void
  ): Promise<ProcessingResult[]> {
    // Fetch all pending documents
    const { data: documents, error } = await supabase
      .from('hfnai_documents')
      .select('id, title')
      .eq('processed', false)
      .is('processing_status', null)
      .or('processing_status.eq.pending,processing_status.eq.failed');

    if (error || !documents) {
      console.error('Error fetching pending documents:', error);
      return [];
    }

    console.log(`Processing ${documents.length} pending documents...`);

    const results: ProcessingResult[] = [];

    for (const doc of documents) {
      console.log(`\nProcessing: ${doc.title}`);

      const result = await this.processDocument(
        doc.id,
        (status) => onProgress?.(doc.id, status)
      );

      results.push(result);

      // Wait 2 seconds between documents to avoid rate limits
      if (documents.indexOf(doc) < documents.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`\n✅ Processed ${successCount}/${documents.length} documents successfully`);

    return results;
  }

  /**
   * Re-process a failed document
   */
  async reprocessDocument(documentId: string): Promise<ProcessingResult> {
    // Reset document status
    await supabase
      .from('hfnai_documents')
      .update({
        processed: false,
        processing_status: 'pending'
      })
      .eq('id', documentId);

    // Delete existing chunks
    await supabase
      .from('hfnai_document_chunks')
      .delete()
      .eq('document_id', documentId);

    // Process again
    return this.processDocument(documentId);
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    total: number;
    processed: number;
    pending: number;
    failed: number;
    processing: number;
  }> {
    const { data: stats } = await supabase
      .from('hfnai_documents')
      .select('processing_status, processed');

    if (!stats) {
      return { total: 0, processed: 0, pending: 0, failed: 0, processing: 0 };
    }

    return {
      total: stats.length,
      processed: stats.filter(s => s.processed).length,
      pending: stats.filter(s => !s.processing_status || s.processing_status === 'pending').length,
      failed: stats.filter(s => s.processing_status === 'failed').length,
      processing: stats.filter(s => s.processing_status === 'processing').length
    };
  }
}
