-- Fix documents that have chunks but aren't marked as processed
-- This handles documents where processing completed but status update failed

-- Update documents that have chunks in hfnai_document_chunks
UPDATE hfnai_documents
SET
  processed = true,
  processing_status = 'completed'
WHERE id IN (
  SELECT DISTINCT document_id
  FROM hfnai_document_chunks
)
AND processed = false;

-- Verify the fix
SELECT
  d.id,
  d.title,
  d.processed,
  d.processing_status,
  m.name as master_name,
  COUNT(c.id) as chunk_count
FROM hfnai_documents d
LEFT JOIN hfnai_masters m ON d.author_master_id = m.id
LEFT JOIN hfnai_document_chunks c ON d.id = c.document_id
GROUP BY d.id, d.title, d.processed, d.processing_status, m.name
ORDER BY d.upload_date DESC;
