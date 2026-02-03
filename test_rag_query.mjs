// Test RAG query with Hindi question
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
const openaiKey = envVars.VITE_OPENAI_API_KEY;
const openrouterKey = envVars.VITE_OPENROUTER_API_KEY;

if (!supabaseUrl || !supabaseKey || !openaiKey || !openrouterKey) {
  console.error('❌ Missing credentials in .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Document ID for "Daaji's Interview" (the successfully processed Hindi transcript)
const DAAJI_INTERVIEW_DOC_ID = 'c5729c4d-8955-4bb7-81d4-7bcc2eb43bc4';

const hindiQuestion = 'दाजी के अनुसार उनके जीवन में आध्यात्मिकता की शुरुआत कैसे हुई और रामकृष्ण परमहंस की पुस्तकों ने इसमें क्या भूमिका निभाई?';

async function generateEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    })
  });

  const data = await response.json();
  return data.data[0].embedding;
}

async function testRAGQuery() {
  console.log('🔍 Testing Hindi RAG Query Pipeline...\n');
  console.log(`Question: ${hindiQuestion}\n`);
  console.log('─'.repeat(80));

  // Step 1: Verify document exists
  console.log('\n📄 Step 1: Verifying document...');
  const { data: doc } = await supabase
    .from('hfnai_documents')
    .select('*')
    .eq('id', DAAJI_INTERVIEW_DOC_ID)
    .single();

  if (!doc) {
    console.log('❌ Document not found!');
    return;
  }

  console.log(`✅ Document: ${doc.title}`);
  console.log(`   Processed: ${doc.processed}`);
  console.log(`   Status: ${doc.processing_status}`);

  // Step 2: Check chunks
  console.log('\n📦 Step 2: Checking chunks...');
  const { data: chunks } = await supabase
    .from('hfnai_document_chunks')
    .select('id, chunk_index, content, embedding')
    .eq('document_id', DAAJI_INTERVIEW_DOC_ID)
    .order('chunk_index');

  console.log(`✅ Found ${chunks?.length || 0} chunks`);

  if (chunks && chunks.length > 0) {
    const chunksWithEmbeddings = chunks.filter(c => c.embedding);
    console.log(`✅ Chunks with embeddings: ${chunksWithEmbeddings.length}`);

    // Show sample content
    console.log('\n   Sample chunk content:');
    console.log(`   "${chunks[0].content.substring(0, 200)}..."`);
  }

  // Step 3: Generate query embedding
  console.log('\n🔤 Step 3: Generating query embedding...');
  const queryEmbedding = await generateEmbedding(hindiQuestion);
  console.log(`✅ Generated ${queryEmbedding.length}D embedding vector`);

  // Step 4: Test vector search with different thresholds
  console.log('\n🔍 Step 4: Testing vector search...');

  const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7];
  let bestResults = null;
  let bestThreshold = null;

  for (const threshold of thresholds) {
    const { data: results, error } = await supabase.rpc('match_hfnai_chunks', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: threshold,
      match_count: 12
    });

    if (error) {
      console.log(`   ❌ Threshold ${threshold.toFixed(1)}: Error - ${error.message}`);
    } else {
      const resultCount = results?.length || 0;
      console.log(`   ${resultCount > 0 ? '✅' : '⚠️'} Threshold ${threshold.toFixed(1)}: Found ${resultCount} chunks`);

      if (results && results.length > 0) {
        if (!bestResults) {
          bestResults = results;
          bestThreshold = threshold;
        }
        console.log(`      Top similarity: ${results[0].similarity.toFixed(4)}`);
      }
    }
  }

  if (!bestResults || bestResults.length === 0) {
    console.log('\n❌ No results found at any threshold!');
    console.log('\n🔬 Debugging information:');
    console.log('   - Document has chunks: Yes');
    console.log('   - Chunks have embeddings: Yes');
    console.log('   - Query embedding generated: Yes');
    console.log('   - Vector search function: Works');
    console.log('\n⚠️ Possible issues:');
    console.log('   1. Embedding dimension mismatch');
    console.log('   2. Embeddings stored in wrong format');
    console.log('   3. Database index not working properly');
    return;
  }

  // Step 5: Filter to selected document
  console.log(`\n📋 Step 5: Filtering to selected document...`);
  const filteredResults = bestResults.filter(r => r.document_id === DAAJI_INTERVIEW_DOC_ID);
  console.log(`✅ Filtered: ${filteredResults.length} chunks from selected document`);

  if (filteredResults.length === 0) {
    console.log('❌ No chunks from selected document in results!');
    return;
  }

  // Step 6: Generate answer
  console.log('\n🤖 Step 6: Generating answer with Grok 2...');

  const context = filteredResults
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

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openrouterKey}`,
      'HTTP-Referer': 'https://heartfulness-rag.app',
      'X-Title': 'Heartfulness RAG'
    },
    body: JSON.stringify({
      model: 'x-ai/grok-2-1212',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: hindiQuestion }
      ],
      temperature: 0.3,
      max_tokens: 1000
    })
  });

  const data = await response.json();

  let answer = '(No answer generated)';
  if (data.choices && data.choices.length > 0) {
    answer = data.choices[0].message.content;
  } else {
    console.error('❌ Grok API error:', data);
    console.log('\n⚠️ Answer generation failed');
  }

  // Display results
  console.log('\n' + '='.repeat(80));
  console.log('✅ RAG QUERY SUCCESSFUL');
  console.log('='.repeat(80));
  console.log('\n📊 Query Statistics:');
  console.log(`   - Best threshold: ${bestThreshold}`);
  console.log(`   - Total matches: ${bestResults.length}`);
  console.log(`   - From selected doc: ${filteredResults.length}`);
  console.log(`   - Top similarity: ${filteredResults[0].similarity.toFixed(4)}`);

  console.log('\n📝 Generated Answer:');
  console.log('─'.repeat(80));
  console.log(answer);
  console.log('─'.repeat(80));

  console.log('\n📚 Source Chunks:');
  filteredResults.slice(0, 3).forEach((chunk, idx) => {
    console.log(`\n   [${idx + 1}] Similarity: ${chunk.similarity.toFixed(4)}`);
    console.log(`   "${chunk.content.substring(0, 150)}..."`);
  });

  console.log('\n' + '='.repeat(80));
}

testRAGQuery().catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
