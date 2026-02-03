// Test Hindi RAG query directly
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY
});

async function testHindiRAG() {
  console.log('🔍 Testing Hindi RAG Pipeline...\n');

  const hindiQuestion = 'दाजी के अनुसार उनके जीवन में आध्यात्मिकता की शुरुआत कैसे हुई और रामकृष्ण परमहंस की पुस्तकों ने इसमें क्या भूमिका निभाई?';

  // Step 1: Find Hindi transcript document
  console.log('📄 Step 1: Finding Hindi transcript document...');
  const { data: documents, error: docError } = await supabase
    .from('hfnai_documents')
    .select('*')
    .ilike('title', '%meditation%relationship%');

  if (docError) {
    console.error('❌ Error fetching documents:', docError);
    return;
  }

  console.log(`✅ Found ${documents.length} documents`);
  documents.forEach(doc => {
    console.log(`   - ${doc.title} (ID: ${doc.id}, Processed: ${doc.processed})`);
  });

  if (documents.length === 0) {
    console.log('❌ No Hindi transcript found!');
    return;
  }

  const docId = documents[0].id;
  console.log(`\n📦 Using document: ${documents[0].title} (${docId})`);

  // Step 2: Check chunks with embeddings
  console.log('\n📦 Step 2: Checking chunks...');
  const { data: chunks, error: chunkError } = await supabase
    .from('hfnai_document_chunks')
    .select('id, chunk_index, token_count, embedding')
    .eq('document_id', docId)
    .limit(5);

  if (chunkError) {
    console.error('❌ Error fetching chunks:', chunkError);
    return;
  }

  console.log(`✅ Found ${chunks.length} chunks (showing first 5)`);
  chunks.forEach(chunk => {
    const hasEmbedding = chunk.embedding ? 'Yes' : 'No';
    const embeddingDim = chunk.embedding ? JSON.parse(chunk.embedding).length : 0;
    console.log(`   - Chunk ${chunk.chunk_index}: ${chunk.token_count} tokens, Embedding: ${hasEmbedding} (${embeddingDim}D)`);
  });

  if (chunks.length === 0 || !chunks[0].embedding) {
    console.log('❌ No chunks with embeddings found!');
    return;
  }

  // Step 3: Generate query embedding
  console.log('\n🔤 Step 3: Generating query embedding...');
  console.log(`   Question: "${hindiQuestion}"`);

  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: hindiQuestion
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;
  console.log(`✅ Generated embedding: ${queryEmbedding.length}D vector`);

  // Step 4: Test vector search with different thresholds
  console.log('\n🔍 Step 4: Testing vector search with different thresholds...');

  const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7];

  for (const threshold of thresholds) {
    const { data: results, error: searchError } = await supabase.rpc('match_hfnai_chunks', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: threshold,
      match_count: 12
    });

    if (searchError) {
      console.log(`   ❌ Threshold ${threshold}: Error - ${searchError.message}`);
    } else {
      console.log(`   ${results.length > 0 ? '✅' : '⚠️'} Threshold ${threshold}: Found ${results.length} chunks`);
      if (results.length > 0) {
        console.log(`      Top similarity: ${results[0].similarity.toFixed(4)}`);
        console.log(`      Content preview: "${results[0].content.substring(0, 100)}..."`);
      }
    }
  }

  // Step 5: Get best results and generate answer
  console.log('\n🎯 Step 5: Getting best matching chunks (threshold 0.3)...');
  const { data: bestResults, error: bestError } = await supabase.rpc('match_hfnai_chunks', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: 0.3,
    match_count: 12
  });

  if (bestError || !bestResults || bestResults.length === 0) {
    console.log('❌ No results found even with threshold 0.3');
    return;
  }

  console.log(`✅ Found ${bestResults.length} chunks`);
  bestResults.slice(0, 3).forEach((result, idx) => {
    console.log(`\n   Chunk ${idx + 1} (similarity: ${result.similarity.toFixed(4)}):`);
    console.log(`   "${result.content.substring(0, 200)}..."`);
  });

  // Step 6: Generate answer using Grok
  console.log('\n🤖 Step 6: Generating answer with Grok 2...');

  const context = bestResults
    .slice(0, 5)
    .map((chunk, idx) => `[${idx + 1}] ${chunk.content}`)
    .join('\n\n');

  const systemPrompt = `You are a spiritual guide AI assistant for Heartfulness meditation. Answer based ONLY on the provided context.

🌐 **LANGUAGE REQUIREMENT (CRITICAL):**
- ALWAYS respond in the SAME LANGUAGE as the question
- If the question is in Hindi, answer in Hindi
- Maintain the same language throughout your entire response

Context:
${context}`;

  const openrouter = new OpenAI({
    apiKey: process.env.VITE_OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1'
  });

  const completion = await openrouter.chat.completions.create({
    model: 'x-ai/grok-2-1212',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: hindiQuestion }
    ],
    temperature: 0.3,
    max_tokens: 1000
  });

  const answer = completion.choices[0].message.content;

  console.log('\n📝 Generated Answer:');
  console.log('─'.repeat(80));
  console.log(answer);
  console.log('─'.repeat(80));
}

testHindiRAG().catch(console.error);
