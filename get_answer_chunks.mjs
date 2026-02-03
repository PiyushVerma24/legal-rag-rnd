// Get full chunks for the answer
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load environment variables
const envFile = readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);
const DAAJI_INTERVIEW_DOC_ID = 'c5729c4d-8955-4bb7-81d4-7bcc2eb43bc4';

async function getChunks() {
  // Get all chunks from the document
  const { data: chunks } = await supabase
    .from('hfnai_document_chunks')
    .select('chunk_index, content')
    .eq('document_id', DAAJI_INTERVIEW_DOC_ID)
    .order('chunk_index');

  console.log('📚 All chunks from "Daaji\'s Interview":\n');
  console.log('='.repeat(80));

  chunks?.forEach(chunk => {
    console.log(`\n[Chunk ${chunk.chunk_index}]`);
    console.log(chunk.content);
    console.log('\n' + '-'.repeat(80));
  });
}

getChunks().catch(console.error);
