export interface Master {
  id: string;
  name: string;
  description: string;
  period_active: string;
}

export interface Document {
  id: string;
  title: string;
  author_master_id: string;
  file_path: string;
  file_type: 'pdf' | 'epub' | 'txt' | 'docx';
  total_pages?: number;
  processed: boolean;
  upload_date: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  content: string;
  page_number?: number;
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
  master_name: string;
  page_number?: number;
  chunk_id: string;
  quote: string;
}

export interface Preceptor {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
}
