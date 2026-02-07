// =====================================================
// Legal RAG R&D - Type Definitions
// =====================================================

export interface LegalCategory {
  id: string;
  name: string;
  description: string;
  category_type: 'jurisdiction' | 'practice_area' | 'case_type' | 'court_level';
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

// Backward compatibility alias
export type Master = LegalCategory;

export interface LegalDocument {
  id: string;
  title: string;
  master_id: string;
  file_path: string;
  file_type: 'pdf' | 'epub' | 'txt' | 'docx';
  file_size?: number;

  // Legal-specific metadata
  case_number?: string;
  court_name?: string;
  judgment_date?: string;
  citation?: string;

  // Processing status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_stage?: string;
  error_message?: string;

  // Document content
  extracted_text?: string;
  total_pages?: number;
  total_chunks?: number;

  // YouTube support (for video evidence/proceedings)
  youtube_url?: string;
  youtube_duration?: string;
  youtube_title?: string;

  // Timestamps
  created_at: string;
  updated_at?: string;

  // Backward compatibility (mapped)
  upload_date?: string; // Mapped from created_at in services
}

// Backward compatibility alias
export type Document = LegalDocument;

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding?: number[];
  token_count?: number;
  page_number?: number;
  created_at?: string;

  // Backward compatibility
  chapter_title?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  created_at: string;
}

export interface Citation {
  document_title: string;
  master_name?: string;
  category_name?: string; // Legal category name
  page_number?: number;
  chunk_id: string;
  quote: string;

  // Legal-specific citation fields
  case_number?: string;
  citation?: string;
  court_name?: string;
}

export interface Lawyer {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
}

// Backward compatibility alias
export type Preceptor = Lawyer;

export interface SavedChat {
  id: string;
  title: string;
  lawyer_id: string;
  conversation: ChatMessage[];
  selected_document_ids: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at?: string;

  // Backward compatibility
  preceptor_id?: string;
}

export interface AIUsageLog {
  id: string;
  lawyer_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost?: number;
  operation_type: 'embedding' | 'rag_query' | 'chat';
  metadata?: Record<string, any>;
  created_at: string;

  // Backward compatibility
  preceptor_id?: string;
}
