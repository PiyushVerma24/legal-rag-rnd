// Direct database test - ES Module format
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load environment variables from .env.local file manually
const envFile = readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHindiTranscript() {
  console.log('🔍 Checking Hindi Transcript in Database...\n');

  // 1. Find the document
  console.log('📄 Step 1: Finding Hindi transcript document...');
  const { data: documents, error: docError } = await supabase
    .from('hfnai_documents')
    .select('*')
    .ilike('title', '%meditation%relationship%');

  if (docError) {
    console.error('❌ Error:', docError);
    return;
  }

  if (!documents || documents.length === 0) {
    console.log('❌ No Hindi transcript document found!');
    return;
  }

  console.log(`✅ Found ${documents.length} document(s):`);
  documents.forEach(doc => {
    console.log(`   - ${doc.title}`);
    console.log(`     ID: ${doc.id}`);
    console.log(`     Processed: ${doc.processed}`);
    console.log(`     Status: ${doc.processing_status}`);
    console.log(`     Master ID: ${doc.master_id}`);
  });

  const doc = documents[0];
  console.log(`\n📦 Using: ${doc.title}\n`);

  // 2. Check chunks
  console.log('📦 Step 2: Checking chunks...');
  const { data: allChunks, error: countError } = await supabase
    .from('hfnai_document_chunks')
    .select('id, chunk_index, token_count, embedding', { count: 'exact' })
    .eq('document_id', doc.id);

  if (countError) {
    console.error('❌ Error:', countError);
    return;
  }

  console.log(`✅ Total chunks: ${allChunks?.length || 0}`);

  if (!allChunks || allChunks.length === 0) {
    console.log('❌ No chunks found for this document!');
    return;
  }

  const chunksWithEmbeddings = allChunks.filter(c => c.embedding);
  console.log(`✅ Chunks with embeddings: ${chunksWithEmbeddings.length}`);

  if (chunksWithEmbeddings.length > 0) {
    const firstEmbedding = chunksWithEmbeddings[0].embedding;
    const embeddingArray = JSON.parse(firstEmbedding);
    console.log(`✅ Embedding dimension: ${embeddingArray.length}D`);
  }

  // 3. Show sample content
  console.log('\n📝 Step 3: Sample chunk content...');
  const { data: sampleChunks, error: sampleError } = await supabase
    .from('hfnai_document_chunks')
    .select('chunk_index, content, token_count')
    .eq('document_id', doc.id)
    .order('chunk_index')
    .limit(3);

  if (sampleError) {
    console.error('❌ Error:', sampleError);
    return;
  }

  sampleChunks?.forEach(chunk => {
    console.log(`\n   Chunk ${chunk.chunk_index} (${chunk.token_count} tokens):`);
    console.log(`   "${chunk.content.substring(0, 150)}..."`);
  });

  // 4. Check if match function exists
  console.log('\n\n🔍 Step 4: Testing vector search function...');
  console.log('Creating a test embedding (zeros) to check if RPC function works...');

  const testEmbedding = new Array(1536).fill(0);
  testEmbedding[0] = 1; // Make it non-zero

  const { data: matchResult, error: matchError } = await supabase.rpc('match_hfnai_chunks', {
    query_embedding: JSON.stringify(testEmbedding),
    match_threshold: 0.1,
    match_count: 5
  });

  if (matchError) {
    console.error('❌ RPC function error:', matchError);
    console.log('\n⚠️  The match_hfnai_chunks function might not exist or has issues!');
    return;
  }

  console.log(`✅ RPC function works! Returned ${matchResult?.length || 0} results`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ DIAGNOSIS COMPLETE');
  console.log('='.repeat(80));
  console.log(`Document: ${doc.title}`);
  console.log(`Total Chunks: ${allChunks.length}`);
  console.log(`With Embeddings: ${chunksWithEmbeddings.length}`);
  console.log(`Vector Search: ${matchError ? 'FAILED' : 'WORKING'}`);
  console.log('='.repeat(80));
}

checkHindiTranscript().catch(err => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
