-- Check if Hindi transcript chunks exist with embeddings
SELECT 
  d.id,
  d.title,
  d.processed,
  COUNT(c.id) as chunk_count,
  COUNT(c.embedding) as chunks_with_embeddings,
  AVG(array_length(c.embedding::float[], 1)) as avg_embedding_dimension
FROM hfnai_documents d
LEFT JOIN hfnai_document_chunks c ON d.id = c.document_id
WHERE d.title LIKE '%Meditation%Relationship%'
GROUP BY d.id, d.title, d.processed;
