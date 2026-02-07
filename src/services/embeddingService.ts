export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
  tokenCount: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  model: string;
  dimensions: number;
  totalTokens: number;
}

export class EmbeddingService {
  private openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
  private readonly MODEL = 'text-embedding-3-small';
  private readonly DIMENSIONS = 1536;
  private readonly MAX_BATCH_SIZE = 100; // OpenAI supports up to 2048, but we'll be conservative

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty');
      }

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiKey}`
        },
        body: JSON.stringify({
          model: this.MODEL,
          input: text,
          dimensions: this.DIMENSIONS
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();

      return {
        embedding: data.data[0].embedding,
        model: this.MODEL,
        dimensions: this.DIMENSIONS,
        tokenCount: data.usage.total_tokens
      };
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batches
   */
  async generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    try {
      if (!texts || texts.length === 0) {
        throw new Error('Texts array cannot be empty');
      }

      // REMOVED: Filter out empty texts - now handled by pipeline before calling this
      // The pipeline ensures all texts are non-empty before sending them here
      // This prevents count mismatches between chunks and embeddings

      // Process in batches to avoid rate limits
      const batches = this.createBatches(texts, this.MAX_BATCH_SIZE);
      const allEmbeddings: number[][] = [];
      let totalTokens = 0;

      console.log(`Generating embeddings for ${texts.length} texts in ${batches.length} batches...`);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} texts)...`);

        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.openaiKey}`
          },
          body: JSON.stringify({
            model: this.MODEL,
            input: batch,
            dimensions: this.DIMENSIONS
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();

        // CRITICAL FIX: OpenAI returns indices relative to the batch (0-99, 0-20, etc.)
        // We need to calculate the absolute index in the full array
        const batchStartIndex = i * this.MAX_BATCH_SIZE;

        // Collect embeddings in order
        for (const item of data.data) {
          const absoluteIndex = batchStartIndex + item.index;
          allEmbeddings[absoluteIndex] = item.embedding;
        }

        totalTokens += data.usage.total_tokens;

        console.log(`✅ Batch ${i + 1} complete: ${data.data.length} embeddings added (indices ${batchStartIndex}-${batchStartIndex + data.data.length - 1})`);

        // Rate limiting: wait 1 second between batches
        if (i < batches.length - 1) {
          await this.sleep(1000);
        }
      }

      console.log(`Generated ${allEmbeddings.length} embeddings using ${totalTokens} tokens`);

      return {
        embeddings: allEmbeddings,
        model: this.MODEL,
        dimensions: this.DIMENSIONS,
        totalTokens
      };
    } catch (error) {
      console.error('Batch embedding generation error:', error);
      throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Validate embedding result
   */
  validateEmbedding(embedding: number[]): { valid: boolean; reason?: string } {
    if (!Array.isArray(embedding)) {
      return { valid: false, reason: 'Embedding is not an array' };
    }

    if (embedding.length !== this.DIMENSIONS) {
      return { valid: false, reason: `Embedding has ${embedding.length} dimensions, expected ${this.DIMENSIONS}` };
    }

    if (embedding.some(v => typeof v !== 'number' || isNaN(v))) {
      return { valid: false, reason: 'Embedding contains invalid values' };
    }

    // Check if embedding is all zeros (unlikely but possible error)
    const sum = embedding.reduce((acc, val) => acc + Math.abs(val), 0);
    if (sum === 0) {
      return { valid: false, reason: 'Embedding is all zeros' };
    }

    return { valid: true };
  }

  /**
   * Estimate cost for embedding generation
   */
  estimateCost(textCount: number, avgTokensPerText: number = 500): {
    totalTokens: number;
    estimatedCostUSD: number;
  } {
    // text-embedding-3-small pricing: $0.020 per 1M tokens
    const pricePerMillionTokens = 0.020;
    const totalTokens = textCount * avgTokensPerText;
    const estimatedCostUSD = (totalTokens / 1_000_000) * pricePerMillionTokens;

    return {
      totalTokens,
      estimatedCostUSD
    };
  }
}
