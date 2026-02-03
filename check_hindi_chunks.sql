-- Check Hindi transcript document and chunks
SELECT
  d.id,
  d.title,
  d.processed,
  d.processing_status,
  d.master_id,
  COUNT(c.id) as total_chunks,
  COUNT(c.embedding) as chunks_with_embeddings,
  SUM(c.token_count) as total_tokens
FROM hfnai_documents d
LEFT JOIN hfnai_document_chunks c ON d.id = c.document_id
WHERE d.title ILIKE '%meditation%relationship%'
GROUP BY d.id, d.title, d.processed, d.processing_status, d.master_id;

-- Show sample chunks with content
SELECT
  c.id,
  c.chunk_index,
  c.token_count,
  CASE
    WHEN c.embedding IS NOT NULL THEN 'Yes (' || array_length(c.embedding::float[], 1) || 'D)'
    ELSE 'No'
  END as has_embedding,
  LEFT(c.content, 200) as content_preview
FROM hfnai_document_chunks c
JOIN hfnai_documents d ON c.document_id = d.id
WHERE d.title ILIKE '%meditation%relationship%'
ORDER BY c.chunk_index
LIMIT 5;
