-- =====================================================
-- Legal RAG R&D - Database Schema Migration
-- =====================================================
-- Description: Complete schema transformation from spiritual meditation to legal research
-- Tables: legalrnd_* prefix (legal + RND suffix)
-- User role: preceptor → lawyer
-- Masters concept: Spiritual masters → Legal categories
-- =====================================================

-- =====================================================
-- 1. LEGAL CATEGORIES TABLE (formerly Masters)
-- =====================================================
-- Purpose: Store legal taxonomies (jurisdictions, practice areas, case types, court levels)
CREATE TABLE IF NOT EXISTS legalrnd_masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    category_type TEXT NOT NULL CHECK (category_type IN ('jurisdiction', 'practice_area', 'case_type', 'court_level')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster category filtering
CREATE INDEX IF NOT EXISTS idx_legalrnd_masters_category_type ON legalrnd_masters(category_type);

-- =====================================================
-- 2. LEGAL DOCUMENTS TABLE
-- =====================================================
-- Purpose: Store legal documents with case metadata
CREATE TABLE IF NOT EXISTS legalrnd_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    master_id UUID REFERENCES legalrnd_masters(id) ON DELETE SET NULL,
    file_path TEXT,
    file_size INTEGER,
    file_type TEXT,

    -- Legal-specific metadata
    case_number TEXT,
    court_name TEXT,
    judgment_date DATE,
    citation TEXT,

    -- Processing status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    processing_stage TEXT,
    error_message TEXT,

    -- Document content
    extracted_text TEXT,
    total_pages INTEGER,
    total_chunks INTEGER,

    -- YouTube support (for video evidence/proceedings)
    youtube_url TEXT,
    youtube_duration TEXT,
    youtube_title TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_legalrnd_documents_master_id ON legalrnd_documents(master_id);
CREATE INDEX IF NOT EXISTS idx_legalrnd_documents_status ON legalrnd_documents(status);
CREATE INDEX IF NOT EXISTS idx_legalrnd_documents_case_number ON legalrnd_documents(case_number);
CREATE INDEX IF NOT EXISTS idx_legalrnd_documents_citation ON legalrnd_documents(citation);
CREATE INDEX IF NOT EXISTS idx_legalrnd_documents_created_at ON legalrnd_documents(created_at DESC);

-- =====================================================
-- 3. DOCUMENT CHUNKS TABLE (Vector Embeddings)
-- =====================================================
-- Purpose: Store chunked document text with embeddings for RAG
CREATE TABLE IF NOT EXISTS legalrnd_document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES legalrnd_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimension
    token_count INTEGER,
    page_number INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique chunks per document
    UNIQUE(document_id, chunk_index)
);

-- B-tree index for document-based queries
CREATE INDEX IF NOT EXISTS idx_legalrnd_chunks_document_id ON legalrnd_document_chunks(document_id);

-- HNSW index for vector similarity search (critical for RAG performance)
CREATE INDEX IF NOT EXISTS idx_legalrnd_chunks_embedding ON legalrnd_document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- =====================================================
-- 4. SAVED CHATS TABLE (Lawyer Chat History)
-- =====================================================
-- Purpose: Store chat sessions for lawyers
CREATE TABLE IF NOT EXISTS legalrnd_saved_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    lawyer_id TEXT NOT NULL, -- Changed from preceptor_id
    conversation JSONB NOT NULL,
    selected_document_ids JSONB DEFAULT '[]',
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for chat retrieval
CREATE INDEX IF NOT EXISTS idx_legalrnd_chats_lawyer_id ON legalrnd_saved_chats(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_legalrnd_chats_pinned ON legalrnd_saved_chats(is_pinned);
CREATE INDEX IF NOT EXISTS idx_legalrnd_chats_created_at ON legalrnd_saved_chats(created_at DESC);

-- =====================================================
-- 5. AI USAGE LOG TABLE
-- =====================================================
-- Purpose: Track AI API usage for cost monitoring
CREATE TABLE IF NOT EXISTS legalrnd_ai_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lawyer_id TEXT NOT NULL, -- Changed from preceptor_id
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    estimated_cost DECIMAL(10, 6),
    operation_type TEXT NOT NULL CHECK (operation_type IN ('embedding', 'rag_query', 'chat')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for usage analytics
CREATE INDEX IF NOT EXISTS idx_legalrnd_usage_lawyer_id ON legalrnd_ai_usage_log(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_legalrnd_usage_created_at ON legalrnd_ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legalrnd_usage_operation ON legalrnd_ai_usage_log(operation_type);

-- =====================================================
-- 6. RPC FUNCTION: Vector Similarity Search
-- =====================================================
-- Purpose: Find most relevant document chunks using cosine similarity
CREATE OR REPLACE FUNCTION match_legalrnd_chunks(
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 10,
    filter_document_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    content TEXT,
    similarity FLOAT,
    chunk_index INTEGER,
    page_number INTEGER,
    document_title TEXT,
    case_number TEXT,
    citation TEXT,
    master_name TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.document_id,
        c.content,
        1 - (c.embedding <=> query_embedding) AS similarity,
        c.chunk_index,
        c.page_number,
        d.title AS document_title,
        d.case_number,
        d.citation,
        m.name AS master_name
    FROM legalrnd_document_chunks c
    JOIN legalrnd_documents d ON c.document_id = d.id
    LEFT JOIN legalrnd_masters m ON d.master_id = m.id
    WHERE
        (filter_document_ids IS NULL OR d.id = ANY(filter_document_ids))
        AND (1 - (c.embedding <=> query_embedding)) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on sensitive tables
ALTER TABLE legalrnd_saved_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE legalrnd_ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Policy: Lawyers can view only their own chats
CREATE POLICY "Lawyers view own chats" ON legalrnd_saved_chats
    FOR SELECT
    USING (auth.jwt() ->> 'email' = lawyer_id);

-- Policy: Lawyers can insert their own chats
CREATE POLICY "Lawyers insert own chats" ON legalrnd_saved_chats
    FOR INSERT
    WITH CHECK (auth.jwt() ->> 'email' = lawyer_id);

-- Policy: Lawyers can update their own chats
CREATE POLICY "Lawyers update own chats" ON legalrnd_saved_chats
    FOR UPDATE
    USING (auth.jwt() ->> 'email' = lawyer_id);

-- Policy: Lawyers can delete their own chats
CREATE POLICY "Lawyers delete own chats" ON legalrnd_saved_chats
    FOR DELETE
    USING (auth.jwt() ->> 'email' = lawyer_id);

-- Policy: Lawyers can view their own usage logs
CREATE POLICY "Lawyers view own usage" ON legalrnd_ai_usage_log
    FOR SELECT
    USING (auth.jwt() ->> 'email' = lawyer_id);

-- Public read access for documents and masters (lawyers need to search all documents)
ALTER TABLE legalrnd_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE legalrnd_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE legalrnd_document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read documents" ON legalrnd_documents FOR SELECT USING (true);
CREATE POLICY "Public read masters" ON legalrnd_masters FOR SELECT USING (true);
CREATE POLICY "Public read chunks" ON legalrnd_document_chunks FOR SELECT USING (true);

-- =====================================================
-- 8. SEED DATA: Legal Categories
-- =====================================================

-- Jurisdictions (Courts)
INSERT INTO legalrnd_masters (name, description, category_type) VALUES
    ('Supreme Court of India', 'Apex court of India with ultimate judicial authority', 'jurisdiction'),
    ('Delhi High Court', 'High Court for the National Capital Territory of Delhi', 'jurisdiction'),
    ('Bombay High Court', 'High Court for Maharashtra, Goa, and Union Territories of Dadra and Nagar Haveli and Daman and Diu', 'jurisdiction'),
    ('Calcutta High Court', 'High Court for West Bengal and Andaman and Nicobar Islands', 'jurisdiction'),
    ('Madras High Court', 'High Court for Tamil Nadu and Puducherry', 'jurisdiction'),
    ('Karnataka High Court', 'High Court for the state of Karnataka', 'jurisdiction'),
    ('Gujarat High Court', 'High Court for the state of Gujarat', 'jurisdiction'),
    ('Kerala High Court', 'High Court for the state of Kerala and Union Territory of Lakshadweep', 'jurisdiction'),
    ('Allahabad High Court', 'High Court for the state of Uttar Pradesh', 'jurisdiction'),
    ('Rajasthan High Court', 'High Court for the state of Rajasthan', 'jurisdiction')
ON CONFLICT (name) DO NOTHING;

-- Practice Areas
INSERT INTO legalrnd_masters (name, description, category_type) VALUES
    ('Constitutional Law', 'Matters related to the Constitution of India, fundamental rights, and constitutional validity', 'practice_area'),
    ('Criminal Law', 'Offenses under IPC, CrPC, and special criminal statutes', 'practice_area'),
    ('Civil Law', 'Civil disputes, contracts, torts, property rights under CPC', 'practice_area'),
    ('Corporate Law', 'Company law, securities law, mergers and acquisitions', 'practice_area'),
    ('Tax Law', 'Income tax, GST, customs, and other taxation matters', 'practice_area'),
    ('Labour & Employment Law', 'Industrial disputes, employment contracts, labor welfare legislation', 'practice_area'),
    ('Intellectual Property Law', 'Patents, trademarks, copyrights, designs, trade secrets', 'practice_area'),
    ('Family Law', 'Marriage, divorce, adoption, succession, guardianship', 'practice_area'),
    ('Environmental Law', 'Environmental protection, pollution control, forest conservation', 'practice_area'),
    ('Administrative Law', 'Government actions, delegated legislation, judicial review', 'practice_area')
ON CONFLICT (name) DO NOTHING;

-- Case Types
INSERT INTO legalrnd_masters (name, description, category_type) VALUES
    ('Writ Petition', 'Petition under Article 32 (SC) or Article 226 (HC) for enforcement of fundamental rights', 'case_type'),
    ('Civil Appeal', 'Appeal against orders/judgments of lower courts in civil matters', 'case_type'),
    ('Criminal Appeal', 'Appeal against conviction or acquittal in criminal cases', 'case_type'),
    ('Special Leave Petition (SLP)', 'Petition under Article 136 seeking leave to appeal to Supreme Court', 'case_type'),
    ('Public Interest Litigation (PIL)', 'Litigation for protection of public interest', 'case_type'),
    ('Review Petition', 'Petition seeking review of Supreme Court or High Court judgment', 'case_type'),
    ('Transfer Petition', 'Petition for transfer of case from one court to another', 'case_type'),
    ('Contempt Petition', 'Petition for punishment of contempt of court', 'case_type'),
    ('Arbitration Matter', 'Matters under Arbitration and Conciliation Act, 1996', 'case_type'),
    ('Company Petition', 'Petitions under Companies Act, 2013', 'case_type')
ON CONFLICT (name) DO NOTHING;

-- Court Levels
INSERT INTO legalrnd_masters (name, description, category_type) VALUES
    ('Supreme Court', 'Apex court with appellate and original jurisdiction', 'court_level'),
    ('High Court', 'Constitutional courts of states with appellate and original jurisdiction', 'court_level'),
    ('District Court', 'Principal civil and criminal courts at district level', 'court_level'),
    ('Sessions Court', 'Criminal courts with jurisdiction to try serious offenses', 'court_level'),
    ('Tribunal', 'Specialized quasi-judicial bodies (NCLT, NCLAT, CAT, etc.)', 'court_level'),
    ('Consumer Court', 'Consumer Disputes Redressal Commissions', 'court_level')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 9. STORAGE BUCKET (to be created via Supabase UI)
-- =====================================================
-- Bucket name: legalrnd-documents
-- Settings:
--   - Public: true (for read access)
--   - File size limit: 50 MB
--   - Allowed MIME types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document

-- =====================================================
-- 10. UPDATED_AT TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_legalrnd_masters_updated_at
    BEFORE UPDATE ON legalrnd_masters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_legalrnd_documents_updated_at
    BEFORE UPDATE ON legalrnd_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_legalrnd_saved_chats_updated_at
    BEFORE UPDATE ON legalrnd_saved_chats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- END OF MIGRATION
-- =====================================================
-- Next steps:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Create storage bucket "legalrnd-documents" via Supabase UI
-- 3. Verify tables created: SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'legalrnd_%';
-- 4. Verify seed data: SELECT name, category_type FROM legalrnd_masters ORDER BY category_type, name;
-- =====================================================
