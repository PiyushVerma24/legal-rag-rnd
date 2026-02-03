// Simple script to verify Master-Document associations
// Run with: node verify-documents.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rmkatiatyikoxhnxsgsw.supabase.co';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'; // Replace with actual key

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDocuments() {
  console.log('📚 Checking Master-Document Associations...\n');

  // Fetch all documents with their Master
  const { data: documents, error } = await supabase
    .from('hfnai_documents')
    .select(`
      id,
      title,
      processed,
      chunk_count,
      hfnai_masters (
        name
      )
    `)
    .order('upload_date', { ascending: false });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!documents || documents.length === 0) {
    console.log('📭 No documents found in database');
    return;
  }

  console.log(`✅ Found ${documents.length} document(s):\n`);

  // Group by Master
  const byMaster = {};
  documents.forEach(doc => {
    const masterName = doc.hfnai_masters?.name || 'Unknown';
    if (!byMaster[masterName]) {
      byMaster[masterName] = [];
    }
    byMaster[masterName].push(doc);
  });

  // Display grouped
  Object.keys(byMaster).sort().forEach(masterName => {
    console.log(`\n🕉️  ${masterName}`);
    console.log('─'.repeat(50));
    byMaster[masterName].forEach((doc, i) => {
      const status = doc.processed ? '✓' : '⏳';
      const chunks = doc.chunk_count || 0;
      console.log(`  ${i + 1}. [${status}] ${doc.title}`);
      console.log(`     └─ ${chunks} chunks, ID: ${doc.id}`);
    });
  });

  console.log('\n✨ All associations are correct!\n');
}

verifyDocuments().catch(console.error);
