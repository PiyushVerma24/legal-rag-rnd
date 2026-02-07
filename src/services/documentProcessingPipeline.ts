import { supabase } from '../lib/supabase';
import { TextExtractionService } from './textExtractionService';
import { ChunkingService, TextChunk, ChunkValidationResult } from './chunkingService';
import { EmbeddingService } from './embeddingService';

export interface ProcessingStatus {
  stage: 'extraction' | 'chunking' | 'validation' | 'embedding' | 'storage' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  error?: string;
  validationResults?: ChunkValidationResult[]; // NEW: Detailed validation results
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
      console.log('🚀🚀🚀 ========== DOCUMENT PROCESSING PIPELINE STARTED ==========');
      console.log(`📄 Processing document ID: ${documentId}`);

      // Fetch document metadata
      onProgress?.({
        stage: 'extraction',
        progress: 0,
        message: 'Fetching document metadata...'
      });

      const { data: document, error: fetchError } = await supabase
        .from('legalrnd_documents')
        .select('*, legalrnd_masters(name)')
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
        .from('legalrnd_documents')
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

      console.log('🔍 ========== STARTING VALIDATION STAGE ==========');
      console.log(`📊 Total chunks to validate: ${chunks.length}`);

      // Stage 2: Validate chunks and collect results
      onProgress?.({
        stage: 'validation',
        progress: 40,
        message: 'Validating chunks...'
      });

      // Collect validation results for ALL chunks
      const validationResults: ChunkValidationResult[] = [];
      const validChunks: TextChunk[] = [];

      chunks.forEach(chunk => {
        const validation = this.chunker.validateChunk(chunk);
        validationResults.push(validation);

        if (validation.valid) {
          validChunks.push(chunk);
        } else {
          console.warn(`Skipping invalid chunk ${chunk.chunkIndex}: ${validation.reason}`);
        }
      });

      const invalidCount = validationResults.filter(r => !r.valid).length;
      console.log(`✅ Validation complete: ${validChunks.length} valid, ${invalidCount} invalid`);
      console.log('🔍 ========== VALIDATION STAGE COMPLETE ==========');

      // Report validation results
      onProgress?.({
        stage: 'validation',
        progress: 45,
        message: `Validated ${chunks.length} chunks (${validChunks.length} valid, ${invalidCount} skipped)`,
        validationResults // Pass validation data to UI
      });

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
          document.legalrnd_masters?.name
        )
      );

      // CRITICAL FIX: Filter out any empty texts AFTER adding context
      // This prevents mismatch between chunk count and embedding count
      const nonEmptyIndices: number[] = [];
      const nonEmptyTexts: string[] = [];

      chunkTexts.forEach((text, index) => {
        if (text && text.trim().length > 0) {
          nonEmptyIndices.push(index);
          nonEmptyTexts.push(text);
        } else {
          console.warn(`Chunk ${validChunks[index].chunkIndex} became empty after adding context, skipping`);
        }
      });

      // Keep only chunks that have non-empty text
      const finalChunks = nonEmptyIndices.map(i => validChunks[i]);

      console.log('🔍 ========== STARTING EMBEDDING STAGE ==========');
      console.log(`📊 Chunks before context: ${validChunks.length}`);
      console.log(`📊 Chunk texts after context: ${chunkTexts.length}`);
      console.log(`📊 Non-empty texts: ${nonEmptyTexts.length}`);
      console.log(`📊 Final chunks to embed: ${finalChunks.length}`);
      console.log(`🚀 Sending ${nonEmptyTexts.length} chunks to embedding service`);

      const embeddingResult = await this.embedder.generateBatchEmbeddings(nonEmptyTexts);

      console.log(`✅ Received ${embeddingResult.embeddings.length} embeddings`);
      console.log(`📊 Total tokens used: ${embeddingResult.totalTokens}`);
      console.log('🔍 ========== EMBEDDING STAGE COMPLETE ==========');

      // Stage 4: Store chunks with embeddings
      onProgress?.({
        stage: 'storage',
        progress: 80,
        message: 'Finalizing... (almost done!)'
      });

      const storedCount = await this.storeChunksWithEmbeddings(
        documentId,
        finalChunks, // Use filtered chunks that match embeddings
        embeddingResult.embeddings
      );

      console.log(`Stored ${storedCount} chunks in database`);

      // Stage 5: Mark as completed
      await this.updateDocumentStatus(documentId, 'completed');

      // Update processed timestamp
      await supabase
        .from('legalrnd_documents')
        .update({
          // status: 'completed' is already set by updateDocumentStatus
          updated_at: new Date().toISOString()
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
      created_at: new Date().toISOString()
    }));

    // Insert in batches of 50 to avoid payload limits
    const batchSize = 50;
    let totalInserted = 0;

    for (let i = 0; i < chunkRecords.length; i += batchSize) {
      const batch = chunkRecords.slice(i, i + batchSize);

      const { error } = await supabase
        .from('legalrnd_document_chunks')
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
  async updateDocumentStatus(
    documentId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    const { error } = await supabase
      .from('legalrnd_documents')
      .update({ status })
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
      .from('legalrnd_documents')
      .select('id, title')
      .eq('status', 'pending');

    if (error || !documents) {
      console.error('Error fetching pending documents:', error);
      return [];
    }

    console.log(`Processing ${documents.length} pending documents...`);

    const results: ProcessingResult[] = [];

    for (const doc of documents) {
      console.log(`
Processing: ${doc.title}`);

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
    console.log(`
✅ Processed ${successCount}/${documents.length} documents successfully`);

    return results;
  }

  /**
   * Re-process a failed document
   */
  async reprocessDocument(documentId: string): Promise<ProcessingResult> {
    // Reset document status
    await supabase
      .from('legalrnd_documents')
      .update({
        status: 'pending'
      })
      .eq('id', documentId);

    // Delete existing chunks
    await supabase
      .from('legalrnd_document_chunks')
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
      .from('legalrnd_documents')
      .select('status');

    if (!stats) {
      return { total: 0, processed: 0, pending: 0, failed: 0, processing: 0 };
    }

    return {
      total: stats.length,
      processed: stats.filter(s => s.status === 'completed').length,
      pending: stats.filter(s => s.status === 'pending').length,
      failed: stats.filter(s => s.status === 'failed').length,
      processing: stats.filter(s => s.status === 'processing').length
    };
  }
}
