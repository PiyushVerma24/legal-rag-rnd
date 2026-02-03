// Download original file from Supabase storage
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);

async function downloadFile() {
  const filePath = 'documents/2025-12-31T13-23-18-429Z_Meditation__Relationship__Pare.txt';

  const { data, error } = await supabase.storage
    .from('hfnai_documents')
    .download(filePath);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const text = await data.text();
  console.log('Original file content (first 2000 chars):');
  console.log('='.repeat(80));
  console.log(text.substring(0, 2000));
  console.log('='.repeat(80));

  // Save to local file for inspection
  writeFileSync('original_transcript.txt', text);
  console.log('\n✅ Saved to original_transcript.txt');
}

downloadFile().catch(console.error);
