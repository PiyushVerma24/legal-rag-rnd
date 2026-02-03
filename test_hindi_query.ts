// Direct test of Hindi RAG query
import { RAGQueryService } from './src/services/ragQueryService';

async function testHindiQuery() {
  console.log('🔍 Testing Hindi RAG Query...\n');

  const ragService = new RAGQueryService();
  const hindiQuestion = 'दाजी के अनुसार उनके जीवन में आध्यात्मिकता की शुरुआत कैसे हुई और रामकृष्ण परमहंस की पुस्तकों ने इसमें क्या भूमिका निभाई?';

  console.log(`Question: ${hindiQuestion}\n`);
  console.log('Querying with document filter: Meditation Relationship with Ramakrishna...\n');

  // First, let's get the document ID for the Hindi transcript
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
  );

  const { data: docs } = await supabase
    .from('hfnai_documents')
    .select('id, title')
    .ilike('title', '%meditation%relationship%');

  console.log('📄 Found documents:');
  docs?.forEach(doc => console.log(`   - ${doc.title} (${doc.id})`));
  console.log('');

  if (!docs || docs.length === 0) {
    console.log('❌ No Hindi transcript document found!');
    return;
  }

  // Check chunks for this document
  const { data: chunks } = await supabase
    .from('hfnai_document_chunks')
    .select('id, chunk_index, content, embedding')
    .eq('document_id', docs[0].id)
    .limit(3);

  console.log(`📦 Document has chunks: ${chunks?.length || 0}`);
  if (chunks && chunks.length > 0) {
    console.log(`   First chunk has embedding: ${chunks[0].embedding ? 'Yes' : 'No'}`);
    if (chunks[0].embedding) {
      const embLen = JSON.parse(chunks[0].embedding as string).length;
      console.log(`   Embedding dimension: ${embLen}D`);
    }
    console.log(`   Content preview: "${chunks[0].content.substring(0, 100)}..."`);
  }
  console.log('');

  // Now test the RAG query
  console.log('🔍 Running RAG query...\n');

  const result = await ragService.queryWithRAG({
    question: hindiQuestion,
    selectedDocumentIds: [docs[0].id],
    conversationHistory: []
  });

  console.log('─'.repeat(80));
  if (result.success) {
    console.log('✅ SUCCESS\n');
    console.log('Answer:');
    console.log(result.answer);
    console.log('');
    console.log(`Sources: ${result.sourceCount} chunks used`);
  } else {
    console.log('❌ FAILED\n');
    console.log(`Error: ${result.message}`);
  }
  console.log('─'.repeat(80));
}

testHindiQuery().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
