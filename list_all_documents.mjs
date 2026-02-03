// List all documents in database
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

async function listAllDocuments() {
  console.log('📚 Listing ALL documents in database...\n');

  const { data: documents, error } = await supabase
    .from('hfnai_documents')
    .select('*')
    .order('upload_date', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!documents || documents.length === 0) {
    console.log('❌ No documents found in database!');
    return;
  }

  console.log(`✅ Found ${documents.length} document(s):\n`);

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    console.log(`${i + 1}. ${doc.title}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Processed: ${doc.processed}`);
    console.log(`   Status: ${doc.processing_status || 'N/A'}`);
    console.log(`   Uploaded: ${new Date(doc.upload_date).toLocaleString()}`);

    // Check chunks for this document
    const { data: chunks } = await supabase
      .from('hfnai_document_chunks')
      .select('id, embedding', { count: 'exact' })
      .eq('document_id', doc.id);

    const chunksWithEmbeddings = chunks?.filter(c => c.embedding) || [];
    console.log(`   Chunks: ${chunks?.length || 0} (${chunksWithEmbeddings.length} with embeddings)`);
    console.log('');
  }

  console.log('─'.repeat(80));
}

listAllDocuments().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
