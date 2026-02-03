import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rmkatiatyikoxhnxsgsw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJta2F0aWF0eWlrb3hobnhzZ3N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4NDU1NjcsImV4cCI6MjA2MTQyMTU2N30.-fsxPzIk7dRuRE5vyL05gM9SRb4SaHiPnpfAZo92y-Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkChunkSchema() {
  console.log('🔍 Checking chunk table schema...\\n');

  // Get a sample chunk to see all columns
  const { data: chunks, error } = await supabase
    .from('hfnai_document_chunks')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error querying chunks:', error);
    return;
  }

  if (chunks && chunks.length > 0) {
    console.log('✅ Sample chunk columns:');
    console.log(Object.keys(chunks[0]).join(', '));
    console.log('\\nFull sample chunk:');
    console.log(JSON.stringify(chunks[0], null, 2));
  } else {
    console.log('⚠️  No chunks found in database');
  }
}

checkChunkSchema().catch(console.error);
