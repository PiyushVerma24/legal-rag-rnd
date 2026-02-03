#!/bin/bash

echo "Creating source files..."

# Create main.tsx
cat > src/main.tsx << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
EOF

# Create index.css
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --spiritual-primary: 139 71 137;
    --spiritual-secondary: 212 165 116;
    --spiritual-accent: 107 144 128;
  }
  
  body {
    @apply bg-gradient-to-br from-purple-50 via-white to-orange-50;
    @apply text-gray-900;
    @apply font-sans;
  }
}

@layer components {
  .spiritual-card {
    @apply bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-purple-100;
  }
  
  .spiritual-button {
    @apply bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800;
    @apply text-white font-medium px-6 py-3 rounded-lg;
    @apply transition-all duration-200;
    @apply shadow-md hover:shadow-lg;
  }
}
EOF

# Create types
cat > src/types/index.ts << 'EOF'
export interface Master {
  id: string;
  name: string;
  description: string;
  period_active: string;
}

export interface Document {
  id: string;
  title: string;
  author_master_id: string;
  file_path: string;
  file_type: 'pdf' | 'epub' | 'txt' | 'docx';
  total_pages?: number;
  processed: boolean;
  upload_date: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  content: string;
  page_number?: number;
  chapter_title?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  created_at: string;
}

export interface Citation {
  document_title: string;
  master_name: string;
  page_number?: number;
  chunk_id: string;
  quote: string;
}

export interface Preceptor {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
}
EOF

# Create Supabase client
cat > src/lib/supabase.ts << 'EOF'
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
EOF

echo "✅ Core source files created"

