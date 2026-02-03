import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rmkatiatyikoxhnxsgsw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJta2F0aWF0eWlrb3hobnhzZ3N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4NDU1NjcsImV4cCI6MjA2MTQyMTU2N30.-fsxPzIk7dRuRE5vyL05gM9SRb4SaHiPnpfAZo92y-Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔍 Testing Supabase Connection...\n');

  // List all tables by querying documents
  const { data: documents, error: docError } = await supabase
    .from('hfnai_documents')
    .select('*')
    .limit(5);

  if (docError) {
    console.error('❌ Error querying documents:', docError);
  } else {
    console.log('✅ Documents in database:');
    console.log(JSON.stringify(documents, null, 2));
  }

  // Count documents
  const { count } = await supabase
    .from('hfnai_documents')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Total documents: ${count}`);

  // Count chunks
  const { count: chunkCount } = await supabase
    .from('hfnai_document_chunks')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total chunks: ${chunkCount}`);
}

testConnection().catch(console.error);
