#!/bin/bash

echo "🕉️  Creating Heartfulness application files..."

# ============================================================================
# SERVICES
# ============================================================================

# Document Upload Service
cat > src/services/documentUploadService.ts << 'EOF'
import { supabase } from '@/lib/supabase';

export class DocumentUploadService {
  async uploadDocument(file: File, masterName: string, title: string) {
    try {
      // Upload file to Supabase Storage
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${timestamp}_${file.name}`;
      const filePath = `documents/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('hfnai-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get file size
      const fileSize = file.size;
      const fileType = file.name.split('.').pop()?.toLowerCase() || 'pdf';

      // Create document record
      const { data: doc, error: docError } = await supabase
        .from('hfnai_documents')
        .insert({
          title,
          file_path: filePath,
          file_type: fileType,
          file_size_bytes: fileSize,
          processed: false,
          processing_status: 'pending'
        })
        .select()
        .single();

      if (docError) throw docError;

      return { success: true, document: doc };
    } catch (error) {
      console.error('Upload error:', error);
      return { success: false, error };
    }
  }

  async getDocuments() {
    const { data, error } = await supabase
      .from('hfnai_documents')
      .select('*, author_master_id(name)')
      .order('upload_date', { ascending: false });

    if (error) throw error;
    return data;
  }
}
EOF

# RAG Query Service
cat > src/services/ragQueryService.ts << 'EOF'
import { supabase } from '@/lib/supabase';

export class RAGQueryService {
  private openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
  private openrouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  private model = import.meta.env.VITE_OPENROUTER_MODEL || 'google/gemini-2.0-flash-exp:free';

  async askQuestion(question: string) {
    try {
      // 1. Validate question
      const validation = await this.validateQuestion(question);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.message
        };
      }

      // 2. Generate embedding
      const embedding = await this.generateEmbedding(question);

      // 3. Search for relevant chunks
      const { data: chunks, error } = await supabase.rpc('match_hfnai_chunks', {
        query_embedding: embedding,
        match_threshold: 0.78,
        match_count: 5
      });

      if (error || !chunks || chunks.length === 0) {
        return {
          success: false,
          message: 'I apologize, but I could not find relevant information in the available texts to answer your question. Please try rephrasing or ask about topics covered in the uploaded spiritual literature.'
        };
      }

      // 4. Generate response with Grok
      const response = await this.generateResponse(question, chunks);

      return {
        success: true,
        answer: response.answer,
        citations: response.citations
      };
    } catch (error) {
      console.error('RAG query error:', error);
      return {
        success: false,
        message: 'An error occurred while processing your question. Please try again.'
      };
    }
  }

  private async validateQuestion(question: string): Promise<{ isValid: boolean; message?: string }> {
    // Basic validation
    if (question.trim().length < 5) {
      return {
        isValid: false,
        message: 'Please ask a more detailed question.'
      };
    }

    // Check for profanity/malicious intent (basic check)
    const inappropriateWords = ['hack', 'attack', 'exploit'];
    if (inappropriateWords.some(word => question.toLowerCase().includes(word))) {
      return {
        isValid: false,
        message: 'Please ask questions related to spirituality and meditation.'
      };
    }

    return { isValid: true };
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    });

    const data = await response.json();
    return data.data[0].embedding;
  }

  private async generateResponse(question: string, chunks: any[]) {
    const context = chunks.map((chunk, idx) => 
      `[Source ${idx + 1}] From "${chunk.document_title}" by ${chunk.master_name}, page ${chunk.page_number}:
"${chunk.content}"`
    ).join('\n\n');

    const prompt = `You are a wise and compassionate spiritual guide for Heartfulness meditation. Answer questions using ONLY the provided sources.

IMPORTANT GUIDELINES:
- Use a polite, reverent, and spiritual tone
- Quote directly from the sources provided
- Include citations in format: [Source X]
- If the sources don't contain the answer, politely say so
- Never make up information
- Encourage spiritual practice and meditation

QUESTION: ${question}

SOURCES:
${context}

Please provide a thoughtful answer based strictly on these sources:`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openrouterKey}`,
        'HTTP-Referer': 'https://heartfulness.org',
        'X-Title': 'Heartfulness Learning System'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a wise spiritual guide for Heartfulness meditation.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await response.json();
    const answer = data.choices[0].message.content;

    // Extract citations
    const citations = chunks.map(chunk => ({
      document_title: chunk.document_title,
      master_name: chunk.master_name,
      page_number: chunk.page_number,
      chunk_id: chunk.id,
      quote: chunk.content.substring(0, 150) + '...'
    }));

    return { answer, citations };
  }
}
EOF

echo "✅ Services created"

# ============================================================================
# PAGES
# ============================================================================

# Chat Page
mkdir -p src/pages/chat
cat > src/pages/chat/ChatPage.tsx << 'EOF'
import { useState } from 'react';
import { RAGQueryService } from '@/services/ragQueryService';
import ReactMarkdown from 'react-markdown';

export default function ChatPage() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const ragService = new RAGQueryService();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const userMessage = { role: 'user', content: question };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setQuestion('');

    const response = await ragService.askQuestion(question);

    const assistantMessage = {
      role: 'assistant',
      content: response.success ? response.answer : response.message,
      citations: response.citations || []
    };

    setMessages(prev => [...prev, assistantMessage]);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="spiritual-card p-4">
        <h1 className="text-2xl font-bold text-purple-800">🕉️ Heartfulness Wisdom</h1>
        <p className="text-gray-600">Ask questions about spiritual teachings and meditation</p>
      </header>

      <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
        <div className="space-y-4 mb-20">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-purple-600 text-white' 
                  : 'spiritual-card'
              }`}>
                <ReactMarkdown className="prose prose-sm">{msg.content}</ReactMarkdown>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-purple-200">
                    <p className="text-xs font-semibold mb-2">Sources:</p>
                    {msg.citations.map((cite: any, i: number) => (
                      <p key={i} className="text-xs text-gray-600">
                        [{i + 1}] {cite.document_title} by {cite.master_name}, p.{cite.page_number}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="spiritual-card p-4">
                <p className="text-gray-600">Searching sacred texts...</p>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-sm border-t border-purple-100">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about meditation, spirituality, or the Masters' teachings..."
            className="flex-1 px-4 py-3 rounded-lg border border-purple-200 focus:outline-none focus:border-purple-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="spiritual-button disabled:opacity-50"
          >
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </form>
      </footer>
    </div>
  );
}
EOF

# Admin Page
mkdir -p src/pages/admin
cat > src/pages/admin/AdminPage.tsx << 'EOF'
import { useState } from 'react';
import { DocumentUploadService } from '@/services/documentUploadService';
import { toast } from 'sonner';

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [master, setMaster] = useState('');
  const [uploading, setUploading] = useState(false);

  const uploadService = new DocumentUploadService();

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title || !master) {
      toast.error('Please fill all fields');
      return;
    }

    setUploading(true);
    const result = await uploadService.uploadDocument(file, master, title);
    setUploading(false);

    if (result.success) {
      toast.success('Document uploaded successfully! Processing will begin shortly.');
      setFile(null);
      setTitle('');
      setMaster('');
    } else {
      toast.error('Upload failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-purple-800 mb-8">📚 Admin - Upload Documents</h1>

        <div className="spiritual-card p-8">
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Document Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Reality at Dawn"
                className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Master/Author</label>
              <select
                value={master}
                onChange={(e) => setMaster(e.target.value)}
                className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
              >
                <option value="">Select Master</option>
                <option value="Babu ji Maharaj">Babu ji Maharaj</option>
                <option value="Lalaji Maharaj">Lalaji Maharaj</option>
                <option value="Chariji Maharaj">Chariji Maharaj</option>
                <option value="Daaji">Daaji</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">File (PDF, EPUB, TXT)</label>
              <input
                type="file"
                accept=".pdf,.epub,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
              />
              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={uploading || !file || !title || !master}
              className="w-full spiritual-button disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </form>
        </div>

        <div className="mt-8 text-sm text-gray-600 space-y-2">
          <p>📖 <strong>Note:</strong> After upload, documents will be automatically processed:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Text extraction from PDF/EPUB</li>
            <li>Intelligent chunking preserving context</li>
            <li>Vector embedding generation</li>
            <li>Storage in database for RAG queries</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
EOF

# Auth Page (Simple)
mkdir -p src/pages/auth
cat > src/pages/auth/AuthPage.tsx << 'EOF'
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const testEmails = [
    'admin@heartfulness.org',
    'preceptor1@heartfulness.org',
    'preceptor2@heartfulness.org',
    'preceptor3@heartfulness.org'
  ];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (testEmails.includes(email)) {
      toast.success('Welcome to Heartfulness Learning System!');
      if (email === 'admin@heartfulness.org') {
        navigate('/admin');
      } else {
        navigate('/chat');
      }
    } else {
      toast.error('Email not recognized. Please use a test account.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full spiritual-card p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-purple-800 mb-2">🕉️ Heartfulness</h1>
          <p className="text-gray-600">Spiritual Learning System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@heartfulness.org"
              className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
            />
          </div>

          <button type="submit" className="w-full spiritual-button">
            Sign In
          </button>
        </form>

        <div className="mt-6 p-4 bg-purple-50 rounded-lg">
          <p className="text-xs font-semibold mb-2">Test Accounts:</p>
          <ul className="text-xs space-y-1">
            <li>• admin@heartfulness.org (Admin)</li>
            <li>• preceptor1@heartfulness.org (Arjun)</li>
            <li>• preceptor2@heartfulness.org (Priya)</li>
            <li>• preceptor3@heartfulness.org (Rajesh)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
EOF

echo "✅ Pages created"
echo "🎉 All application files created successfully!"
echo ""
echo "Next steps:"
echo "  1. Copy environment variables from case-wise-crm"
echo "  2. Run: npm install"
echo "  3. Run: npm run dev"
echo "  4. Open: http://localhost:5174"

