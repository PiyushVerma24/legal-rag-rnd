import { supabase } from '@/lib/supabase';
import { EmbeddingService } from './embeddingService';

interface Citation {
  document_id: string; // For tracking and linking
  document_title: string;
  master_name: string;
  page_number?: number;
  chunk_id: string;
  quote: string; // Short preview (200 chars)
  full_content: string; // Full chunk content for modal/expansion
  similarity?: number;
  position_in_document?: number; // Order/sequence in original document
  chapter?: string; // If available in metadata
  youtube_video_id?: string; // YouTube video ID for embedding
  start_timestamp?: number; // Video timestamp in seconds
  end_timestamp?: number; // Video end timestamp in seconds
  file_url?: string; // Public URL for the file
  file_type?: string; // File type (pdf, txt, etc)
  file_path?: string; // Original file path for debugging
}

interface RAGResponse {
  success: boolean;
  answer?: string;
  summary?: string;
  citations?: Citation[];
  reading_time?: {
    summary: string;
    detail: string;
  };
  message?: string;
  metadata?: {
    model: string;
    chunkCount: number;
    embeddingModel: string;
    totalTokens?: number;
  };
  debug?: {
    systemPrompt: string;
    userPrompt: string;
  };
}

export class RAGQueryService {
  private openrouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  private embedder = new EmbeddingService();

  // Model priority list with fallback (Grok 4.1 fast - same as Veritas chat)
  private modelPriority = [
    'x-ai/grok-4.1-fast', // Grok 4.1 Fast (FREE! - same as Veritas)
    'x-ai/grok-4-fast', // Grok 4 Fast (very cheap fallback)
    'x-ai/grok-4', // Standard Grok 4
    'x-ai/grok-2-1212', // Grok 2 fallback
    'x-ai/grok-beta',
    'google/gemini-2.0-flash-exp:free',
    'anthropic/claude-3-haiku',
    'meta-llama/llama-3.1-8b-instruct:free'
  ];

  async askQuestion(
    question: string,
    options: {
      preceptorId?: string;
      selectedDocumentIds?: string[];
      selectedMasters?: string[];
    } = {}
  ): Promise<RAGResponse> {
    const { preceptorId, selectedDocumentIds, selectedMasters } = options;
    const startTime = Date.now();

    try {
      // 1. Validate question
      const validation = await this.validateQuestion(question);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.message
        };
      }

      // 2. Generate embedding
      console.log('Generating embedding for question...');
      const embeddingResult = await this.embedder.generateEmbedding(question);

      // 3. Multi-query search strategy
      const searchQueries = this.generateSearchQueries(question);
      console.log(`Searching with ${searchQueries.length} query variations...`);

      let allChunks: any[] = [];

      // Search with each query variation
      for (const searchQuery of searchQueries) {
        const queryEmbedding = await this.embedder.generateEmbedding(searchQuery);

        const { data: chunks, error } = await supabase.rpc('match_hfnai_chunks', {
          query_embedding: JSON.stringify(queryEmbedding.embedding),
          match_threshold: 0.30, // Lower threshold for multilingual content (Hindi shows 0.35-0.37 similarity)
          match_count: 12 // More chunks for better coverage with lower threshold
        });

        if (error) {
          console.error('Vector search error:', error);
        } else if (chunks && chunks.length > 0) {
          console.log(`Query "${searchQuery.substring(0, 50)}..." found ${chunks.length} chunks`);
          allChunks.push(...chunks);
        } else {
          console.warn(`Query "${searchQuery.substring(0, 50)}..." found 0 chunks`);
        }
      }

      // Remove duplicates and sort by similarity
      let uniqueChunks = this.deduplicateChunks(allChunks);
      console.log(`Found ${uniqueChunks.length} unique relevant chunks`);

      // Filter by selected documents if provided
      if (selectedDocumentIds && selectedDocumentIds.length > 0) {
        uniqueChunks = uniqueChunks.filter(chunk =>
          selectedDocumentIds.includes(chunk.document_id)
        );
        console.log(`Filtered to ${uniqueChunks.length} chunks from selected documents`);
      }

      // Filter by selected masters if provided
      if (selectedMasters && selectedMasters.length > 0 && uniqueChunks.length > 0) {
        // Get document IDs for selected masters
        const { data: documents } = await supabase
          .from('hfnai_documents')
          .select('id, author_master_id, hfnai_masters!inner(name)')
          .in('hfnai_masters.name', selectedMasters);

        if (documents) {
          const allowedDocIds = new Set(documents.map((d: any) => d.id));
          uniqueChunks = uniqueChunks.filter(chunk =>
            allowedDocIds.has(chunk.document_id)
          );
          console.log(`Filtered to ${uniqueChunks.length} chunks from selected masters`);
        }
      }

      // 4. Fetch full document context if needed
      const enhancedChunks = await this.enhanceChunksWithDocumentContext(uniqueChunks);

      if (enhancedChunks.length === 0) {
        // IMPORTANT: Do NOT use fallback if documents were explicitly selected
        // The user wants answers ONLY from their selected documents
        if (selectedDocumentIds && selectedDocumentIds.length > 0) {
          return {
            success: false,
            message: '🙏 I could not find relevant information in the selected documents to answer your question. Please try:\n- Asking a different question\n- Selecting additional documents\n- Rephrasing your question with different keywords'
          };
        }

        if (selectedMasters && selectedMasters.length > 0) {
          return {
            success: false,
            message: '🙏 I could not find relevant information from the selected Master\'s teachings to answer your question. Please try:\n- Asking a different question\n- Selecting additional Masters\n- Rephrasing your question with different keywords'
          };
        }

        // Only use fallback if NO documents/masters were selected
        const fallbackChunks = await this.getFallbackChunks();

        if (fallbackChunks.length === 0) {
          return {
            success: false,
            message: '🙏 I apologize, but I could not find relevant information in the available spiritual texts to answer your question. Please try rephrasing your question or ask about topics related to Heartfulness meditation, spirituality, and the teachings of our Masters.'
          };
        }

        return this.generateResponseWithFallback(question, fallbackChunks);
      }

      // 5. Generate response with multi-model fallback
      const response = await this.generateResponseWithFallback(question, enhancedChunks);

      // 6. Log AI usage with comprehensive details
      const documentsUsed = [...new Set(enhancedChunks.map(c => c.document_title))];
      await this.logAIUsage(
        preceptorId || null,
        question,
        response.metadata?.model || 'unknown',
        embeddingResult.tokenCount + (response.metadata?.totalTokens || 0),
        response.answer,
        documentsUsed
      );

      const duration = Date.now() - startTime;
      console.log(`✅ RAG query completed in ${duration}ms`);

      return response;
    } catch (error) {
      console.error('RAG query error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `🙏 An error occurred: ${errorMessage}`
      };
    }
  }

  /**
   * Generate multiple search query variations for better retrieval
   */
  private generateSearchQueries(originalQuery: string): string[] {
    const queries = [originalQuery];
    const lowerQuery = originalQuery.toLowerCase();

    // Detect request for simple/basic explanation
    const needsSimple = /simple|basic|beginner|introduction|explain|overview/i.test(originalQuery);

    // Extract the main topic
    let topic = originalQuery;
    if (lowerQuery.includes('explain')) {
      topic = originalQuery.replace(/explain|in|very|simple|words|about|the/gi, '').trim();
    }

    // If asking for simple explanation, prioritize introductory content
    if (needsSimple && topic) {
      queries.push(`introduction to ${topic}`);
      queries.push(`${topic} basics`);
      queries.push(`what is ${topic}`);
      queries.push(`${topic} for beginners`);
      queries.push(`${topic} overview`);
    }

    // Add expanded query with meditation context
    queries.push(`${originalQuery} in Heartfulness meditation spiritual practice`);

    // Add question reformulations
    if (lowerQuery.includes('what is')) {
      queries.push(originalQuery.replace(/what is/i, 'meaning of'));
      queries.push(originalQuery.replace(/what is/i, 'introduction to'));
    }

    if (lowerQuery.includes('how to')) {
      queries.push(originalQuery.replace(/how to/i, 'practice of'));
      queries.push(originalQuery.replace(/how to/i, 'method for'));
    }

    if (lowerQuery.includes('why')) {
      queries.push(originalQuery.replace(/why/i, 'reason for'));
      queries.push(originalQuery.replace(/why/i, 'purpose of'));
    }

    console.log(`Generated ${queries.length} search queries:`, queries);
    return queries;
  }

  /**
   * Remove duplicate chunks based on chunk_id
   */
  private deduplicateChunks(chunks: any[]): any[] {
    const seen = new Set();
    return chunks.filter(chunk => {
      if (seen.has(chunk.id)) {
        return false;
      }
      seen.add(chunk.id);
      return true;
    }).sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  }

  /**
   * Enhance chunks with full document context and file info
   */
  private async enhanceChunksWithDocumentContext(chunks: any[]): Promise<any[]> {
    // Fetch document metadata for each chunk
    const documentIds = [...new Set(chunks.map(c => c.document_id))];

    // Note: full_text and page_count columns might not exist
    const { data: documents } = await supabase
      .from('hfnai_documents')
      .select('id, title, file_path, file_type')
      .in('id', documentIds);

    if (!documents) return chunks;

    // Map documents by ID for quick lookup
    const docMap = new Map(documents.map(d => [d.id, d]));

    // Enhance each chunk with document info
    return chunks.map(chunk => ({
      ...chunk,
      // document_full_text: docMap.get(chunk.document_id)?.full_text, // Removed as column missing
      // document_page_count: docMap.get(chunk.document_id)?.page_count, // Removed as column missing
      file_path: docMap.get(chunk.document_id)?.file_path,
      file_type: docMap.get(chunk.document_id)?.file_type
    }));
  }

  /**
   * Get fallback chunks from recent documents
   */
  private async getFallbackChunks(): Promise<any[]> {
    const { data: chunks } = await supabase
      .from('hfnai_document_chunks')
      .select(`
        *,
        hfnai_documents!inner(title, author_master_id, file_path, file_type)
      `)
      .limit(3);

    // Map the nested join structure to flat properties to match enhancedChunks format
    return (chunks || []).map((chunk: any) => ({
      ...chunk,
      file_path: chunk.hfnai_documents?.file_path,
      file_type: chunk.hfnai_documents?.file_type
    }));
  }

  /**
   * Validate question relevance and safety
   */
  private async validateQuestion(question: string): Promise<{ isValid: boolean; message?: string }> {
    // Length validation
    if (question.trim().length < 5) {
      return {
        isValid: false,
        message: 'Please ask a more detailed question.'
      };
    }

    if (question.trim().length > 5000) {
      return {
        isValid: false,
        message: 'Your question is too long. Please keep it under 5000 characters.'
      };
    }

    // Check for inappropriate content
    const inappropriatePatterns = [
      /\b(hack|crack|exploit|attack|malware|virus)\b/i,
      /\b(porn|xxx|sex)\b/i,
      /\b(kill|murder|death|suicide)\b/i
    ];

    for (const pattern of inappropriatePatterns) {
      if (pattern.test(question)) {
        return {
          isValid: false,
          message: '🙏 Please ask questions related to spirituality, meditation, and Heartfulness teachings.'
        };
      }
    }

    // Allow general questions without strict keyword matching
    // Only flag completely off-topic questions
    const offTopicKeywords = ['sports', 'politics', 'movie', 'game', 'recipe', 'weather'];
    const isOffTopic = offTopicKeywords.some(keyword =>
      question.toLowerCase().includes(keyword)
    );

    if (isOffTopic) {
      return {
        isValid: false,
        message: '🙏 I am here to help with questions about Heartfulness meditation and spirituality. Please ask questions related to these topics.'
      };
    }

    return { isValid: true };
  }

  /**
   * Generate response with multi-model fallback
   */
  private async generateResponseWithFallback(question: string, chunks: any[]): Promise<RAGResponse> {
    // Build context from chunks
    const context = chunks.map((chunk, idx) => {
      const pageInfo = chunk.page_number ? `, page ${chunk.page_number}` : '';
      const similarity = chunk.similarity ? ` (relevance: ${(chunk.similarity * 100).toFixed(0)}%)` : '';

      return `[Source ${idx + 1}] From "${chunk.document_title}" by ${chunk.master_name}${pageInfo}${similarity}:
"${chunk.content}"`;
    }).join('\n\n');

    // Detect if user wants simple/beginner-friendly explanation
    const needsSimple = /simple|basic|beginner|easy|introduction|explain|layman/i.test(question);

    const systemPrompt = `🛑 **OUTPUT FORMAT INSTRUCTIONS (CRITICAL)**:
You must structure your entire response into TWO DISTINCT PARTS separated by exactly "---SECTION_SEPARATOR---".

**PART 1: BRIEF SUMMARY**
- Provide a concise summary of the answer in a single paragraph (5-6 sentences).
- Estimate reading time: ~30 seconds.
- Do NOT use any markdown headers (like # or ##) in this part. Just plain text.

---SECTION_SEPARATOR---

**PART 2: DETAILED ANSWER**
- This is the main response following all the standard formatting rules below (Title, Core Concepts, Practices, etc.).
- This part must match the "ANSWER STRUCTURE" template exactly.

You are a highly skilled spiritual educator for Heartfulness meditation. Your task is to create clear, well-structured, and comprehensive answers based on the provided sources.

🌐 **LANGUAGE REQUIREMENT (CRITICAL):**
- ALWAYS respond in the SAME LANGUAGE as the question
- If the question is in Hindi, answer in Hindi
- If the question is in English, answer in English
- If the question is in any other language, answer in that language
- Maintain the same language throughout your entire response

📋 **FORMATTING REQUIREMENTS (CRITICAL):**
- Start with a clear, bold title that directly answers the question
- Use markdown headers (##, ###) for main sections
- Use numbered lists (1. 2. 3.) for sequential concepts or categories
- Use bullet points (-) for practices, examples, or sub-points
- Add explanatory notes in parentheses for clarity (e.g., "pranahuti"—like charging a battery)
- Use **bold** for important terms or concepts
- Keep paragraphs short (2-3 sentences max)
- Create a logical flow: Introduction → Key Concepts → Practices → Conclusion

📖 **CONTENT GUIDELINES:**
- Answer ONLY using the provided sources - never fabricate information
- Synthesize information from multiple sources into a coherent narrative
- Include [Source X] citations after key points or quotes
- If sources mention specific examples, analogies, or metaphors, USE THEM
- Extract practical applications and daily practices when available
- Preserve the exact meaning and spirit of the teachings
${needsSimple ? `\n⭐ **SIMPLE EXPLANATION MODE (ACTIVE):**
- Use everyday language and relatable analogies
- Structure as: What it is → Why it matters → How to practice → Expected outcomes
- Explain technical terms immediately when first used
- Focus on foundational concepts before advanced ones
- Use numbered sections for different aspects (e.g., "3 Pillars", "5 Core Principles")
- Make it comprehensive yet accessible - aim for completeness within simplicity` : ''}

🎯 **ANSWER STRUCTURE (Follow this template):**
1. **Title/Introduction**: Brief definition or overview (1-2 sentences)
2. **Core Concepts**: Main philosophical or practical points (numbered list with sub-bullets)
3. **Practices/Methods**: How to apply the teaching (bullet points with specifics)
4. **Purpose/Goal**: What the practice leads to
5. **Source References**: Cite documents clearly

🙏 **TONE:**
- Clear and educational, yet warm and respectful
- Minimize flowery language - prioritize clarity
- Use emojis sparingly (🕉️ 🙏 ❤️ ✨) - only for section headers if needed
- Avoid excessive reverence that obscures meaning

AVAILABLE SOURCES (${chunks.length} passages):
${context}`;

    const userPrompt = `QUESTION: ${question}

Create a ${needsSimple ? 'comprehensive yet simple, well-structured' : 'thorough and well-organized'} answer using ONLY the sources above. Follow the formatting requirements exactly. Use markdown formatting, numbered lists, bullet points, and clear section headers. Include [Source X] citations after key points.`;

    let lastError: Error | null = null;

    // Try each model in priority order
    for (const model of this.modelPriority) {
      try {
        console.log(`Attempting to generate response with ${model}...`);

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.openrouterKey}`,
            'HTTP-Referer': 'https://heartfulness.org',
            'X-Title': 'Heartfulness RAG Learning System'
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 2000 // Increased for comprehensive, well-formatted answers like Veritas
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const rawAnswer = data.choices[0].message.content;
        const { summary, answer, readingTime } = this.parseModelResponse(rawAnswer);

        // Extract citations with full details for clickable sources
        const citations: Citation[] = chunks.map((chunk, index) => {
          // Generate public URL if file_path exists
          let fileUrl = undefined;
          if (chunk.file_path) {
            const { data } = supabase.storage
              .from('hfnai-documents') // Correct bucket name (verified with test script)
              .getPublicUrl(chunk.file_path);
            fileUrl = data.publicUrl;
          }

          // Normalize file type for frontend
          let fileType = chunk.file_type || 'text';

          // Check explicit type OR file extension
          const isPdf = fileType.toLowerCase() === 'pdf' ||
            fileType.toLowerCase() === 'application/pdf' ||
            (chunk.file_path && chunk.file_path.toLowerCase().endsWith('.pdf'));

          if (isPdf) {
            fileType = 'application/pdf';
          }

          return {
            document_id: chunk.document_id,
            document_title: chunk.document_title,
            master_name: chunk.master_name,
            page_number: chunk.page_number,
            chunk_id: chunk.id,
            quote: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
            full_content: chunk.content, // Full text for modal display
            similarity: chunk.similarity,
            position_in_document: chunk.position || index,
            chapter: chunk.metadata?.chapter || null,
            youtube_video_id: chunk.youtube_video_id || null,
            start_timestamp: chunk.start_timestamp || null,
            end_timestamp: chunk.end_timestamp || null,
            file_url: fileUrl,
            file_type: fileType
          };
        });

        console.log(`✅ Successfully generated response with ${model}`);

        return {
          success: true,
          answer,
          summary,
          citations,
          reading_time: readingTime,
          metadata: {
            model,
            chunkCount: chunks.length,
            embeddingModel: 'text-embedding-3-small',
            totalTokens: data.usage?.total_tokens
          },
          debug: {
            systemPrompt,
            userPrompt
          }
        };
      } catch (error) {
        console.warn(`Failed to generate with ${model}:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next model
      }
    }

    // All models failed
    throw new Error(`All models failed. Last error: ${lastError?.message}`);
  }

  /**
   * Log AI usage for comprehensive tracking (like Case-wise-crm-gemma)
   */
  private async logAIUsage(
    preceptorId: string | null,
    query: string,
    model: string,
    tokenCount: number,
    response?: string,
    documents?: string[],
    costUSD?: number
  ): Promise<void> {
    try {
      const logEntry = {
        preceptor_id: preceptorId,
        query_text: query,
        model_used: model,
        token_count: tokenCount,
        input_tokens: tokenCount, // Approximate - can be refined with actual API response
        output_tokens: response ? Math.ceil(response.length / 4) : 0, // Rough estimate
        total_tokens: tokenCount + (response ? Math.ceil(response.length / 4) : 0),
        cost_usd: costUSD || this.estimateCost(model, tokenCount),
        documents_used: documents || [],
        response_preview: response ? response.substring(0, 500) : null,
        session_id: null, // Can be added if you track sessions
        created_at: new Date().toISOString()
      };

      console.log('📊 Logging AI usage:', {
        model,
        tokens: logEntry.total_tokens,
        cost: logEntry.cost_usd,
        docs: documents?.length || 0
      });

      await supabase.from('hfnai_ai_usage_log').insert(logEntry);
    } catch (error) {
      // Silently fail - logging shouldn't break the query
      console.warn('Failed to log AI usage:', error);
    }
  }

  /**
   * Estimate API cost based on model and token count
   */
  private estimateCost(model: string, tokens: number): number {
    // Rough cost estimates per 1M tokens (adjust based on actual pricing)
    const costPer1M: { [key: string]: number } = {
      'x-ai/grok-2-1212': 2.0,
      'x-ai/grok-beta': 2.0,
      'google/gemini-2.0-flash-exp:free': 0,
      'anthropic/claude-3-haiku': 0.25,
      'meta-llama/llama-3.1-8b-instruct:free': 0
    };

    const modelCost = costPer1M[model] || 1.0;
    return (tokens / 1_000_000) * modelCost;
  }

  /**
   * Helper to parse the 2-part response and calculate reading time
   */
  private parseModelResponse(rawContent: string): {
    summary: string;
    answer: string;
    readingTime: { summary: string; detail: string }
  } {
    const parts = rawContent.split('---SECTION_SEPARATOR---');

    let summary = '';
    let answer = '';

    if (parts.length >= 2) {
      summary = parts[0].trim();
      answer = parts[1].trim();
      // Remove any leftover "PART 1" or "PART 2" labels if the model hallucinated them
      summary = summary.replace(/^\*\*PART 1:.*?\*\*/i, '').trim();
      answer = answer.replace(/^\*\*PART 2:.*?\*\*/i, '').trim();
    } else {
      // Fallback: If separator missing, generate a pseudo-summary from the first paragraph
      answer = rawContent.trim();
      // Try to take the first paragraph as summary (up to double newline)
      const firstParaMatch = answer.match(/^(.*?)(\n\n|$)/s);
      if (firstParaMatch && firstParaMatch[1].length < 500) { // Limit length to avoid grabbing huge chunks
        summary = firstParaMatch[1].trim();
      } else {
        summary = "Please refer to the detailed answer below.";
      }
    }

    return {
      summary,
      answer,
      readingTime: {
        summary: this.calculateReadingTime(summary),
        detail: this.calculateReadingTime(answer)
      }
    };
  }

  /**
   * Calculate reading time (assuming 200 wpm)
   */
  private calculateReadingTime(text: string): string {
    const wordCount = text.split(/\s+/).length;
    const minutes = wordCount / 200;

    if (minutes < 1) {
      return '< 1 min read';
    }
    return `${Math.ceil(minutes)} min read`;
  }
}
