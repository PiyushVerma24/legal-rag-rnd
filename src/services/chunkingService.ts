import { TimestampMapping, PageMapping } from './textExtractionService';

export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  pageNumber?: number;
  startChar: number;
  endChar: number;
  startTimestamp?: number; // Video timestamp in seconds
  endTimestamp?: number; // Video timestamp in seconds
}

export interface ChunkValidationResult {
  valid: boolean;
  reason?: string;
  severity: 'error' | 'warning' | 'info';
  chunkIndex: number;
  pageNumber?: number;
  contentPreview: string; // First 100 chars for display
  tokenCount: number;
}

export class ChunkingService {
  private readonly MIN_CHUNK_SIZE = 500; // tokens
  private readonly MAX_CHUNK_SIZE = 1000; // tokens
  private readonly OVERLAP_SIZE = 100; // tokens for context continuity
  private readonly CHARS_PER_TOKEN = 4; // rough approximation

  /**
   * Split text into intelligent chunks with overlap
   */
  chunkText(
    fullText: string,
    pageCount?: number,
    _documentTitle?: string,
    timestampMappings?: TimestampMapping[],
    pageMappings?: PageMapping[]
  ): TextChunk[] {
    const chunks: TextChunk[] = [];

    // Text is already normalized by TextExtractionService to preserve page mapping indices
    const cleanedText = fullText;

    // Split into paragraphs first to maintain semantic boundaries
    const paragraphs = this.splitIntoParagraphs(cleanedText);

    let currentChunk = '';
    let currentChunkTokens = 0;
    let chunkIndex = 0;

    // We need to track the start position of the current chunk in the fullText
    // Since chunks are built from paragraphs, we track the start of the first paragraph in the chunk
    let chunkStartChar = 0;
    let lastSearchPos = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const paragraphTokens = this.estimateTokens(paragraph);

      // Find the actual start position of this paragraph in the fullText
      // This ensures our indices align exactly with pageMappings
      const paragraphStartChar = fullText.indexOf(paragraph, lastSearchPos);

      // If found, update our search cursor. If not found (shouldn't happen), assume sequential fallback
      if (paragraphStartChar !== -1) {
        lastSearchPos = paragraphStartChar + paragraph.length;
      } else {
        // Fallback: This means normalization changed the text such that exact match failed.
        // But since we removed extra normalization, this should be rare.
        // We'll proceed with lastSearchPos + newline assumption
        console.warn(`Could not find paragraph index for: "${paragraph.substring(0, 30)}..."`);
      }

      // If this is the first paragraph of a new chunk, record its start position
      if (currentChunk.length === 0) {
        chunkStartChar = paragraphStartChar !== -1 ? paragraphStartChar : lastSearchPos;
      }

      // If adding this paragraph would exceed max chunk size
      if (currentChunkTokens + paragraphTokens > this.MAX_CHUNK_SIZE && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          content: currentChunk.trim(),
          chunkIndex: chunkIndex++,
          tokenCount: currentChunkTokens,
          pageNumber: this.getPageNumber(chunkStartChar, fullText.length, pageCount, pageMappings),
          startChar: chunkStartChar,
          endChar: chunkStartChar + currentChunk.length
        });

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk);
        currentChunk = overlapText + '\n\n' + paragraph;
        currentChunkTokens = this.estimateTokens(currentChunk);

        // Update chunkStartChar for the new chunk. 
        // Ideally, it should point to where the overlap text started, OR the start of the new paragraph?
        // Actually, the new chunk technically starts at the new paragraph's position minus the overlap.
        // But finding exact overlap position in fullText is hard.
        // Simplified: The new chunk's PRIMARY content starts at the new paragraph. 
        // Let's use paragraphStartChar as the anchor for the new chunk's "start" for page lookup purposes.
        chunkStartChar = paragraphStartChar !== -1 ? paragraphStartChar : lastSearchPos;
      }
      // If single paragraph is too large, split it
      else if (paragraphTokens > this.MAX_CHUNK_SIZE) {
        // Save current chunk if it exists
        if (currentChunk.length > 0) {
          const endChar = chunkStartChar + currentChunk.length;
          const timestamps = this.calculateChunkTimestamps(chunkStartChar, endChar, timestampMappings);
          chunks.push({
            content: currentChunk.trim(),
            chunkIndex: chunkIndex++,
            tokenCount: currentChunkTokens,
            pageNumber: this.getPageNumber(chunkStartChar, fullText.length, pageCount, pageMappings),
            startChar: chunkStartChar,
            endChar,
            ...timestamps
          });
        }

        // Split large paragraph into sentences
        const subChunks = this.splitLargeParagraph(paragraph);
        let subChunkStartChar = paragraphStartChar !== -1 ? paragraphStartChar : lastSearchPos;

        for (const subChunk of subChunks) {
          const endChar = subChunkStartChar + subChunk.length;
          const timestamps = this.calculateChunkTimestamps(subChunkStartChar, endChar, timestampMappings);
          chunks.push({
            content: subChunk.trim(),
            chunkIndex: chunkIndex++,
            tokenCount: this.estimateTokens(subChunk),
            pageNumber: this.getPageNumber(subChunkStartChar, fullText.length, pageCount, pageMappings),
            startChar: subChunkStartChar,
            endChar,
            ...timestamps
          });
          subChunkStartChar += subChunk.length + 1; // +1 for space assumption
        }

        currentChunk = '';
        currentChunkTokens = 0;
        // Reset chunkStartChar for next iteration
        chunkStartChar = -1;
      }
      // Add paragraph to current chunk
      else {
        if (currentChunk.length > 0) {
          currentChunk += '\n\n' + paragraph;
        } else {
          currentChunk = paragraph;
          // Redundant but safe: ensure chunkStartChar is set if it was reset
          if (chunkStartChar === -1) chunkStartChar = paragraphStartChar;
        }
        currentChunkTokens += paragraphTokens;
      }
    }

    // Add final chunk if it exists
    if (currentChunk.length > 0 && currentChunkTokens >= this.MIN_CHUNK_SIZE / 2) {
      if (chunkStartChar === -1) chunkStartChar = lastSearchPos - currentChunk.length; // Fallback

      const endChar = chunkStartChar + currentChunk.length;
      const timestamps = this.calculateChunkTimestamps(chunkStartChar, endChar, timestampMappings);
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex: chunkIndex++,
        tokenCount: currentChunkTokens,
        pageNumber: this.getPageNumber(chunkStartChar, fullText.length, pageCount, pageMappings),
        startChar: chunkStartChar,
        endChar,
        ...timestamps
      });
    }

    console.log(`Created ${chunks.length} chunks from ${fullText.length} characters`);
    console.log(`Average chunk size: ${Math.round(chunks.reduce((sum, c) => sum + c.tokenCount, 0) / chunks.length)} tokens`);

    return chunks;
  }



  /**
   * Split text into paragraphs
   */
  private splitIntoParagraphs(text: string): string[] {
    return text
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // More accurate estimation considering words and punctuation
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount * 1.3); // Accounts for subword tokenization
  }

  /**
   * Get overlap text from end of chunk
   */
  private getOverlapText(chunk: string): string {
    const targetChars = this.OVERLAP_SIZE * this.CHARS_PER_TOKEN;

    // Get last few sentences that fit within overlap size
    const sentences = chunk.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let overlapText = '';

    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i].trim();
      if (overlapText.length + sentence.length <= targetChars) {
        overlapText = sentence + '. ' + overlapText;
      } else {
        break;
      }
    }

    return overlapText.trim();
  }

  /**
   * Split a large paragraph into smaller chunks by sentences
   */
  private splitLargeParagraph(paragraph: string): string[] {
    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);

      if (this.estimateTokens(currentChunk) + sentenceTokens > this.MAX_CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Get page number based on character position using accurate mappings
   */
  private getPageNumber(charPosition: number, totalChars: number, pageCount?: number, pageMappings?: PageMapping[]): number | undefined {
    // Priority 1: Use accurate page mappings if available
    if (pageMappings && pageMappings.length > 0) {
      // Find the page where charPosition falls between startChar and endChar
      // Note: We scan linearly or binary search. Given page count is usually < 1000, linear is fine for now.
      const mapping = pageMappings.find(m => charPosition >= m.startChar && charPosition < m.endChar);

      // If found, return it
      if (mapping) return mapping.pageNumber;

      // Edge case: boundaries might be slightly off due to cleaning/normalization
      // Try to find closest page
    }

    // Priority 2: Fallback to estimation (legacy behavior)
    if (!pageCount || pageCount <= 0) return undefined;

    const percentage = charPosition / totalChars;
    return Math.max(1, Math.ceil(percentage * pageCount));
  }

  /**
   * Add context prefix to chunk (document title, page number)
   */
  addChunkContext(chunk: TextChunk, documentTitle: string, masterName?: string): string {
    const parts: string[] = [];

    if (masterName) {
      parts.push(`Master: ${masterName}`);
    }

    parts.push(`Document: ${documentTitle}`);

    if (chunk.pageNumber) {
      parts.push(`Page: ${chunk.pageNumber}`);
    }

    const contextHeader = parts.join(' | ');
    return `[${contextHeader}]\n\n${chunk.content}`;
  }

  /**
   * Validate chunk quality with detailed results
   */
  validateChunk(chunk: TextChunk): ChunkValidationResult {
    const contentPreview = chunk.content.substring(0, 100);

    // Check for empty or whitespace-only content
    if (!chunk.content || chunk.content.trim().length === 0) {
      return {
        valid: false,
        reason: 'Empty content (whitespace only)',
        severity: 'error',
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        contentPreview: '[EMPTY]',
        tokenCount: chunk.tokenCount
      };
    }

    // Check minimum content length (stricter than token count)
    if (chunk.content.trim().length < 10) {
      return {
        valid: false,
        reason: 'Content too short (< 10 characters)',
        severity: 'error',
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        contentPreview,
        tokenCount: chunk.tokenCount
      };
    }

    // Check minimum token count
    if (chunk.tokenCount < 50) {
      return {
        valid: false,
        reason: 'Chunk too short (< 50 tokens)',
        severity: 'warning',
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        contentPreview,
        tokenCount: chunk.tokenCount
      };
    }

    // Check maximum token count
    if (chunk.tokenCount > 8000) {
      return {
        valid: false,
        reason: 'Chunk exceeds token limit (> 8000 tokens)',
        severity: 'error',
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        contentPreview,
        tokenCount: chunk.tokenCount
      };
    }

    // Check if chunk is mostly whitespace or special characters
    // Use Unicode-aware regex to support all languages (Hindi, Sanskrit, etc.)
    const alphaNumMatches = chunk.content.match(/[\p{L}\p{N}]/gu) || [];
    const alphaNumRatio = alphaNumMatches.length / chunk.content.length;

    console.log(`Chunk ${chunk.chunkIndex} validation:`, {
      totalChars: chunk.content.length,
      alphaNumChars: alphaNumMatches.length,
      ratio: alphaNumRatio.toFixed(2),
      sampleMatches: alphaNumMatches.slice(0, 20).join(''),
      contentPreview
    });

    // Lower threshold to 0.4 for scripts with combining characters (Devanagari, Arabic, etc.)
    if (alphaNumRatio < 0.4) {
      return {
        valid: false,
        reason: 'Chunk contains too few alphanumeric characters',
        severity: 'warning',
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        contentPreview,
        tokenCount: chunk.tokenCount
      };
    }

    // Check if chunk has actual sentences
    // Support both Latin (. ! ?) and Devanagari (। ॥) sentence terminators
    const sentenceCount = (chunk.content.match(/[.!?।॥]+/g) || []).length;
    if (sentenceCount === 0 && chunk.tokenCount > 100) {
      return {
        valid: false,
        reason: 'Chunk lacks proper sentence structure',
        severity: 'warning',
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        contentPreview,
        tokenCount: chunk.tokenCount
      };
    }

    return {
      valid: true,
      severity: 'info',
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      contentPreview,
      tokenCount: chunk.tokenCount
    };
  }

  /**
   * Calculate video timestamps for a chunk based on its character position
   * Uses timestamp mappings from YouTube transcript
   */
  private calculateChunkTimestamps(
    startChar: number,
    endChar: number,
    timestampMappings?: TimestampMapping[]
  ): { startTimestamp?: number; endTimestamp?: number } {
    if (!timestampMappings || timestampMappings.length === 0) {
      return { startTimestamp: undefined, endTimestamp: undefined };
    }

    // Find the closest timestamp before or at startChar
    let startTimestamp: number | undefined;
    let endTimestamp: number | undefined;

    // Find start timestamp (latest mapping before or at startChar)
    for (let i = timestampMappings.length - 1; i >= 0; i--) {
      if (timestampMappings[i].characterIndex <= startChar) {
        startTimestamp = timestampMappings[i].timestamp;
        break;
      }
    }

    // Find end timestamp (latest mapping before or at endChar)
    for (let i = timestampMappings.length - 1; i >= 0; i--) {
      if (timestampMappings[i].characterIndex <= endChar) {
        endTimestamp = timestampMappings[i].timestamp;
        break;
      }
    }

    // If we found an end timestamp, use it; otherwise use start timestamp
    if (!endTimestamp) {
      endTimestamp = startTimestamp;
    }

    return { startTimestamp, endTimestamp };
  }
}
