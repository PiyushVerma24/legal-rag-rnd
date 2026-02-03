// Get original file path for the document
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

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

async function getOriginalFile() {
  const { data: doc } = await supabase
    .from('hfnai_documents')
    .select('*')
    .eq('id', DAAJI_INTERVIEW_DOC_ID)
    .single();

  console.log('Document info:');
  console.log(`Title: ${doc.title}`);
  console.log(`File path: ${doc.file_path}`);
  console.log(`File type: ${doc.file_type}`);
  console.log('\nFull text preview (first 1000 chars):');
  console.log('─'.repeat(80));
  console.log(doc.full_text?.substring(0, 1000) || 'No full_text stored');
  console.log('─'.repeat(80));
}

getOriginalFile().catch(console.error);
