import { supabase } from '../lib/supabase';

export interface TimestampMapping {
  characterIndex: number; // Character position in the cleaned text
  timestamp: number; // Time in seconds
  originalTimestamp: string; // Original timestamp string (e.g., "[00:01:23]")
}

export interface PageMapping {
  pageNumber: number;
  startChar: number;
  endChar: number;
}

interface ExtractionResult {
  fullText: string;
  pageCount: number;
  extractionMethod: 'pdf-parse' | 'gpt4o-vision' | 'epub-parse';
  confidence: number;
  charCount: number;
  avgCharsPerPage: number;
  timestampMappings?: TimestampMapping[]; // For YouTube transcripts
  pageMappings?: PageMapping[]; // Accurate page boundary mappings
}

export class TextExtractionService {
  // private openaiKey = import.meta.env.VITE_OPENAI_API_KEY; // For future OCR cleanup

  /**
   * Main extraction method - tries PDF parsing first, falls back to OCR if needed
   */
  async extractText(filePath: string, fileType: string): Promise<ExtractionResult> {
    if (fileType === 'pdf') {
      return await this.extractFromPDF(filePath);
    } else if (fileType === 'epub') {
      return await this.extractFromEPUB(filePath);
    } else if (fileType === 'txt') {
      return await this.extractFromText(filePath);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  /**
   * Extract text from PDF - uses dual method approach
   */
  private async extractFromPDF(filePath: string): Promise<ExtractionResult> {
    try {
      // Download file from Supabase Storage
      const { data: fileData, error } = await supabase.storage
        .from('legalrnd-documents')
        .download(filePath);

      if (error) throw error;

      // Convert to ArrayBuffer
      const arrayBuffer = await fileData.arrayBuffer();

      // Try PDF parsing first (lightweight, fast for text PDFs)
      const pdfResult = await this.parsePDFText(arrayBuffer);

      // Calculate confidence based on character density
      const avgCharsPerPage = pdfResult.charCount / pdfResult.pageCount;
      let confidence = 0;
      let extractionMethod: 'pdf-parse' | 'gpt4o-vision' = 'pdf-parse';
      let finalText = pdfResult.fullText;

      if (avgCharsPerPage < 100) {
        // Likely scanned document - use GPT-4o Vision
        console.log(`Low character density (${avgCharsPerPage.toFixed(0)} chars/page). Using OCR.`);
        confidence = 0.3;
        const ocrResult = await this.extractWithVision(arrayBuffer, pdfResult.pageCount);
        finalText = ocrResult.fullText;
        extractionMethod = 'gpt4o-vision';
        confidence = 0.9; // GPT-4o Vision is highly accurate
      } else if (avgCharsPerPage < 500) {
        // Mixed or poor quality - use Vision for better results
        console.log(`Medium character density (${avgCharsPerPage.toFixed(0)} chars/page). Using OCR.`);
        confidence = 0.6;
        const ocrResult = await this.extractWithVision(arrayBuffer, pdfResult.pageCount);
        finalText = ocrResult.fullText;
        extractionMethod = 'gpt4o-vision';
        confidence = 0.9;
      } else {
        // Good text extraction
        confidence = 0.95;
      }

      return {
        fullText: finalText,
        pageCount: pdfResult.pageCount,
        extractionMethod,
        confidence,
        charCount: finalText.length,
        avgCharsPerPage: finalText.length / pdfResult.pageCount,
        pageMappings: pdfResult.pageMappings
      };
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`Failed to extract PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse PDF using pdfjs-dist text extraction
   */
  private async parsePDFText(arrayBuffer: ArrayBuffer): Promise<{ fullText: string; pageCount: number; charCount: number; pageMappings: PageMapping[] }> {
    try {
      // Dynamically import pdfjs-dist
      const pdfjsLib = await import('pdfjs-dist');

      // Set worker source using CDN (required for pdfjs-dist in browser)
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/build/pdf.worker.mjs';

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        useSystemFonts: true,
        standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/standard_fonts/'
      });

      const pdf = await loadingTask.promise;
      const pageCount = pdf.numPages;
      let fullText = '';
      const pageMappings: PageMapping[] = [];

      console.log(`Extracting text from ${pageCount} pages...`);

      // Extract text from each page
      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Combine text items with spaces
        const pageText = textContent.items
          .map((item: any) => {
            if ('str' in item) {
              return item.str;
            }
            return '';
          })
          .join(' ');

        // Normalize page text BEFORE appending to fullText so indices match
        const normalizedPageText = this.normalizeText(pageText);

        const startChar = fullText.length;
        // Add double newline for page separation
        const separator = i < pageCount ? '\n\n' : '';
        fullText += normalizedPageText + separator;

        pageMappings.push({
          pageNumber: i,
          startChar,
          endChar: startChar + normalizedPageText.length
        });

        // Log progress every 10 pages
        if (i % 10 === 0) {
          console.log(`  Processed ${i}/${pageCount} pages...`);
        }
      }

      const charCount = fullText.length;

      console.log(`✅ Extracted ${charCount} characters from ${pageCount} pages`);

      return {
        fullText: fullText.trim(),
        pageCount,
        charCount,
        pageMappings
      };
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text using GPT-4o Vision OCR
   */
  private async extractWithVision(_arrayBuffer: ArrayBuffer, pageCount: number): Promise<{ fullText: string }> {
    try {
      // Limit to first 25 pages for cost control
      const maxPages = Math.min(pageCount, 25);

      console.log(`Extracting ${maxPages} pages using GPT-4o Vision...`);

      // Convert PDF pages to images and extract text
      // This would require pdf-to-png conversion
      // For now, using placeholder approach

      // System prompt for GPT-4o Vision:
      // "You are a precise OCR system. Extract ALL text from this image EXACTLY as it appears.
      // - Preserve all formatting, line breaks, and spacing
      // - Include page numbers, headers, and footers
      // - Do not add any commentary or interpretation
      // - Return ONLY the extracted text"

      // In production, this would loop through each page:
      // 1. Convert PDF page to PNG using pdf.js or similar
      // 2. Send to GPT-4o Vision API
      // 3. Collect extracted text

      // For now, mock implementation
      console.warn('Vision OCR not fully implemented - would process each page');

      return {
        fullText: 'Vision OCR placeholder. Implement PDF-to-image conversion for actual OCR.'
      };
    } catch (error) {
      console.error('Vision OCR error:', error);
      throw new Error(`Vision OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from EPUB files
   */
  private async extractFromEPUB(filePath: string): Promise<ExtractionResult> {
    try {
      const { data: _fileData, error } = await supabase.storage
        .from('legalrnd-documents')
        .download(filePath);

      if (error) throw error;

      // EPUB extraction would use epub-parser or similar library
      // For now, placeholder implementation
      console.warn('EPUB parsing not yet implemented');

      return {
        fullText: 'EPUB extraction placeholder',
        pageCount: 1,
        extractionMethod: 'epub-parse',
        confidence: 0.5,
        charCount: 27,
        avgCharsPerPage: 27,
        pageMappings: [{ pageNumber: 1, startChar: 0, endChar: 27 }] // Placeholder
      };
    } catch (error) {
      console.error('EPUB extraction error:', error);
      throw new Error(`Failed to extract EPUB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from plain text files
   */
  private async extractFromText(filePath: string): Promise<ExtractionResult> {
    try {
      const { data: fileData, error } = await supabase.storage
        .from('legalrnd-documents')
        .download(filePath);

      if (error) throw error;

      const rawText = await fileData.text();

      // Clean YouTube transcript format if detected and extract timestamp mappings
      const { cleanedText, timestampMappings } = this.cleanYouTubeTranscript(rawText);

      const charCount = cleanedText.length;

      // Estimate pages (assuming ~2000 chars per page)
      const pageCount = Math.max(1, Math.ceil(charCount / 2000));

      return {
        fullText: cleanedText,
        pageCount,
        extractionMethod: 'pdf-parse', // Using pdf-parse as generic text method
        confidence: 1.0,
        charCount,
        avgCharsPerPage: charCount / pageCount,
        timestampMappings: timestampMappings.length > 0 ? timestampMappings : undefined,
        pageMappings: [{ pageNumber: 1, startChar: 0, endChar: charCount }] // Treat text files as 1 big page for now, or could split by size
      };
    } catch (error) {
      console.error('Text extraction error:', error);
      throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean YouTube transcript format and extract timestamp mappings
   * Handles formats: "[00:00:00]", "[0:00]", "00:00", "1:23:45", etc.
   * Returns both cleaned text and timestamp-to-character mappings
   */
  private cleanYouTubeTranscript(text: string): { cleanedText: string; timestampMappings: TimestampMapping[] } {
    const timestampMappings: TimestampMapping[] = [];

    // Pattern for timestamps in brackets: [00:00:00] or [0:00]
    const bracketTimestampPattern = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;

    // Check if text has timestamps
    const testMatches = text.match(bracketTimestampPattern);
    if (!testMatches || testMatches.length < 3) {
      // Doesn't look like a YouTube transcript
      return { cleanedText: text, timestampMappings: [] };
    }

    console.log(`Detected YouTube transcript format (${testMatches.length} timestamps). Extracting mappings...`);

    // Process text line by line, extracting timestamps and building cleaned text
    const lines = text.split('\n');
    let cleanedText = '';
    let currentTimestamp = 0; // Track last seen timestamp

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Check if line starts with a timestamp
      const match = trimmedLine.match(/^\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*(.*)/);

      if (match) {
        // Extract timestamp
        const hours = match[3] ? parseInt(match[1]) : 0;
        const minutes = match[3] ? parseInt(match[2]) : parseInt(match[1]);
        const seconds = match[3] ? parseInt(match[3]) : parseInt(match[2]);

        currentTimestamp = hours * 3600 + minutes * 60 + seconds;

        // Store mapping: current position in cleaned text -> timestamp
        timestampMappings.push({
          characterIndex: cleanedText.length,
          timestamp: currentTimestamp,
          originalTimestamp: match[0].match(/\[.*?\]/)![0]
        });

        // Add the text without timestamp
        const textContent = match[4].trim();
        if (textContent) {
          cleanedText += textContent + ' ';
        }
      } else {
        // Line without timestamp, just add it
        cleanedText += trimmedLine + ' ';
      }
    }

    // Merge short segments into paragraphs
    const sentences = cleanedText.split(/(?<=[.!?।॥])\s+/);
    const paragraphs: string[] = [];
    let currentParagraph = '';

    for (const sentence of sentences) {
      currentParagraph += sentence + ' ';

      // Start new paragraph after a few sentences or at certain punctuation
      if (/[.!?।॥]$/.test(sentence) && currentParagraph.length > 200) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
    }

    if (currentParagraph.trim()) {
      paragraphs.push(currentParagraph.trim());
    }

    const result = paragraphs.join('\n\n');
    console.log(`Cleaned transcript: ${text.length} → ${result.length} characters, ${timestampMappings.length} timestamps`);

    return { cleanedText: result, timestampMappings };
  }

  /**
   * Clean OCR garbage using GPT-4o-mini
   * NOTE: Currently unused but available for future OCR text cleanup
   */
  /*
  private async cleanOCRText(rawText: string): Promise<string> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Clean OCR text by removing artifacts, fixing spacing, and correcting obvious errors. Preserve the original meaning and structure.'
            },
            {
              role: 'user',
              content: rawText
            }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('OCR cleaning error:', error);
      // Return original text if cleaning fails
      return rawText;
    }
  /**
   * Normalize text - remove excessive whitespace, fix encoding issues
   * Copied from ChunkingService to ensure consistency with page mapping
   */
  private normalizeText(text: string): string {
    return text
      // Fix common encoding issues
      .replace(/â€™/g, "'")
      .replace(/â€œ/g, '"')
      .replace(/â€/g, '"')
      .replace(/â€"/g, '—')
      // Normalize whitespace
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      // Remove excessive line breaks (more than 2)
      .replace(/\n{3,}/g, '\n\n')
      // Remove excessive spaces
      .replace(/ {2,}/g, ' ')
      .trim();
  }
}
