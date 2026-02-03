# Heartfulness RAG System - Project Context

## Quick Start for Claude Code Sessions

**Database:** Already configured - Supabase PostgreSQL
**GitHub:** https://github.com/PiyushVerma24/heartfulness-rag-system
**Production:** https://app-piyush-vermas-projects-4a8be759.vercel.app
**MCP Servers:** Auto-configured in `.mcp-config.json`

## Project Overview

RAG-powered chatbot for Heartfulness meditation wisdom with YouTube integration, multilingual support (English/Hindi/Devanagari), and AI-powered semantic search.

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + pgvector)
- **AI Models:**
  - Primary: Grok 4.1 Fast (x-ai/grok-4.1-fast) - FREE!
  - Embedding: OpenAI text-embedding-3-small
  - Fallback: Grok 4, Gemini 2.0 Flash, Claude Haiku, Llama 3.1
- **Deployment:** Vercel (auto-deploy from GitHub)

## Database Connection

```bash
# Supabase PostgreSQL
Host: db.rmkatiatyikoxhnxsgsw.supabase.co
Database: postgres
User: postgres
Password: Supabase@2025

# Connection String
postgresql://postgres:Supabase@2025@db.rmkatiatyikoxhnxsgsw.supabase.co:5432/postgres
```

## Key Features

### 1. YouTube Integration
- Extract timestamps from YouTube transcripts `[HH:MM:SS]` format
- Map text chunks to video timestamps
- Picture-in-picture video players in chat
- Deep-linking to exact video moments

### 2. RAG System
- Vector search with pgvector
- Multi-query search strategy
- Similarity threshold: 0.30 (optimized for Hindi/multilingual)
- Chunk size: ~500 tokens with overlap

### 3. Document Processing
- Supports: PDF, TXT, DOCX, YouTube transcripts
- Unicode/Devanagari support
- Automatic chunking and embedding
- Metadata extraction and storage

### 4. Chat Interface
- Real-time RAG-powered answers
- Source citations with expandable content
- Focus mode (fullscreen on typing)
- Export to PDF
- Save/load chat history
- Privacy-compliant user-specific storage

### 5. Admin Features
- Document upload with YouTube URL support
- Master/author organization
- Processing pipeline monitoring
- Document tree selector with smart defaults

## Database Schema

### Main Tables
- `hfnai_documents` - Document metadata
- `hfnai_document_chunks` - Text chunks with embeddings
- `hfnai_masters` - Authors/masters
- `hfnai_saved_chats` - User chat history
- `hfnai_ai_usage_log` - AI usage tracking

### YouTube Support Columns
```sql
-- In hfnai_documents
youtube_url TEXT
youtube_video_id TEXT

-- In hfnai_document_chunks
start_timestamp INTEGER  -- Video timestamp in seconds
end_timestamp INTEGER
```

## Environment Variables

See `.env.local` for full configuration:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- `VITE_OPENAI_API_KEY` - OpenAI API key (embeddings)
- `VITE_OPENROUTER_API_KEY` - OpenRouter API key (Grok)

## Common Tasks

### Query Database
```bash
node test-supabase-connection.mjs
```

### Deploy to Production
```bash
git add .
git commit -m "Description"
git push origin main
# Vercel auto-deploys within 20-30 seconds
```

### Build Locally
```bash
npm run build
```

### Run Dev Server
```bash
npm run dev
```

## Project Structure

```
src/
├── components/          # React components
│   ├── DocumentTreeSelector.tsx
│   ├── SourceCitation.tsx
│   └── YouTubePlayer.tsx
├── pages/              # Page components
│   ├── admin/          # Admin interface
│   └── chat/           # Chat interface
├── services/           # Business logic
│   ├── ragQueryService.ts
│   ├── embeddingService.ts
│   ├── textExtractionService.ts
│   ├── chunkingService.ts
│   └── documentProcessingPipeline.ts
└── utils/              # Utilities

migrations/             # Database migrations
└── add_youtube_support.sql
```

## Deployment Status

### Completed Features ✅
- RAG query with Grok 4.1 fast
- YouTube timestamp extraction
- Multilingual support (English/Hindi)
- Focus mode
- Default document selection
- Chat history
- Mobile-responsive design
- GitHub auto-deployment

### Pending ⚠️
- YouTube database migration (SQL in `migrations/` folder)
- Upload YouTube transcript to test

## Important Notes

1. **Database Migration Required:** Run `migrations/add_youtube_support.sql` in Supabase SQL Editor for YouTube features to work

2. **Model Priority:** System tries Grok 4.1 Fast first (FREE), then falls back to other models

3. **Multilingual:** Vector search threshold lowered to 0.30 for better Hindi/Devanagari support

4. **Privacy:** Chat history is user-specific, stored with user ID prefix

5. **Vercel:** Connected to GitHub - auto-deploys on push to main branch

## Quick Reference

**Test YouTube:** Use `https://youtu.be/khoHUl12lQQ` with Hindi transcript
**Supabase Dashboard:** https://supabase.com/dashboard/project/rmkatiatyikoxhnxsgsw
**GitHub Repo:** https://github.com/PiyushVerma24/heartfulness-rag-system
**Vercel Project:** https://vercel.com/piyush-vermas-projects-4a8be759/app

## Owner Information

**Account:** PiyushVerma24
**Supabase:** Pro account with team management
**Database Password:** Supabase@2025

## Known Issues 🐛

### 1. Chat Disappearance / Lack of Persistence
**Status:** Open
**Severity:** Medium
**Description:** The "Quick Login" feature in `AuthPage.tsx` simulates authentication but does not create a real Supabase session. Consequently, `EnhancedChatPage.tsx` often defaults to a null user state on page reload or network fluctuation, leading to:
- Loss of chat history (chat clears unexpectedly).
- Inability to save chats reliably to local storage.
**Proposed Fix:** Implement "Guest" persistence mode in `chatHistoryService.ts` to allow saving chats for non-authenticated users to `localStorage` under a reliable guest key, or enforce real Supabase auth sessions.

### 2. Inaccurate Page Number Citation
**Status:** Open
**Severity:** Low (UX)
**Description:** Citations often show "Page 1" or inaccurate page references.
- **Cause:** `TextExtractionService` concatenates all PDF pages into a single text block. `ChunkingService` estimates page numbers based on character position ratio (`charPos / totalLength * totalPages`), which is imprecise for variable-density documents.
- **Impact:** Users cannot reliably find the exact source page in the physical/digital book.
**Proposed Fix:** Refactor ingestion pipeline to be "Page-Aware":
1. Extract text page-by-page.
2. Tag textual chunks with their exact origin page number during ingestion.
3. Requires re-processing (delete & re-upload) of existing documents.

### 3. No Database Persistence for Mock Users
**Status:** Open
**Severity:** Medium
**Description:** Chat history for "Mock Login" users (e.g., Preceptor 1) is ONLY saved to browser `localStorage` and not the Supabase database.
- **Cause:** Database table `hfnai_saved_chats` requires a valid Auth UUID (Foreign Key constraint), but mock users use static string IDs (e.g., "1").
- **Impact:** Chat history is lost if the user clears browser cache or switches devices. Administrators cannot audit/view these chats.
**Proposed Fix:** Implement real Supabase Authentication (Sign Up/Login) or create a "Guest" shadow account system in the backend to map mock IDs to real UUIDs.

## AI Usage & Billing Calculation

The `hfnai_ai_usage_log` table tracks token usage and limits. Here is how the values are calculated:

### 1. Token Counts
- **Input Tokens (`input_tokens`)**:
  - Calculated as: `Embedding Tokens` + `LLM Total Tokens (Prompt + Completion)`
  - *Note: This acts as a cumulative count of accurate API token usage.*
- **Output Tokens (`output_tokens`)**:
  - Estimated as: `Ceiling(Response Length in chars / 4)`
- **Total Tokens (`total_tokens`)**:
  - Calculated as: `input_tokens` + `output_tokens`
  - *Note: Since `input_tokens` already includes the LLM completion tokens, this value currently double-counts the output (Formula: API Total + Estimated Output).*

### 2. Cost Calculation (`cost_usd`)
Cost is estimated based on the **Input Tokens** value (which stores the API Total) multiplied by the model-specific rate per 1M tokens.

**Model Rates (per 1M tokens):**
- **Grok 2 / Beta**: $2.00
- **Claude 3 Haiku**: $0.25
- **Gemini 2.0 Flash**: Free ($0.00)
- **Llama 3.1 8b**: Free ($0.00)
- **Grok 4.1 Fast**: Free ($0.00)
- **Default/Other**: $1.00

