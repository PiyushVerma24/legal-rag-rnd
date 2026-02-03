-- Add YouTube support to documents and chunks

-- Add youtube_url to documents table
ALTER TABLE hfnai_documents
ADD COLUMN IF NOT EXISTS youtube_url TEXT,
ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;

-- Add timestamp information to chunks table
ALTER TABLE hfnai_document_chunks
ADD COLUMN IF NOT EXISTS start_timestamp INTEGER, -- Start time in seconds
ADD COLUMN IF NOT EXISTS end_timestamp INTEGER;   -- End time in seconds

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_documents_youtube_video_id
ON hfnai_documents(youtube_video_id)
WHERE youtube_video_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN hfnai_documents.youtube_url IS 'Full YouTube URL (e.g., https://youtu.be/khoHUl12lQQ)';
COMMENT ON COLUMN hfnai_documents.youtube_video_id IS 'Extracted YouTube video ID for embedding (e.g., khoHUl12lQQ)';
COMMENT ON COLUMN hfnai_document_chunks.start_timestamp IS 'Start time of this chunk in the video (seconds)';
COMMENT ON COLUMN hfnai_document_chunks.end_timestamp IS 'End time of this chunk in the video (seconds)';
