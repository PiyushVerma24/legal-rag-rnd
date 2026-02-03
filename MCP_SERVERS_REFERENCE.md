# MCP Servers Reference Guide

This document lists all MCP servers configured for the Heartfulness RAG System project.

## Auto-Activated Servers

These servers are automatically available at the start of every Claude Code session:

### 1. Database Server (`database-server`)
**Status:** ✅ Auto-activated
**Purpose:** Direct database access for queries and operations
**Configuration:**
```json
{
  "database_url": "postgresql+asyncpg://postgres:Supabase@2025@db.rmkatiatyikoxhnxsgsw.supabase.co:5432/postgres"
}
```
**Capabilities:**
- Execute SQL queries
- Manage database schema
- Query documents and chunks
- Monitor database health

**Usage Example:**
```sql
SELECT * FROM hfnai_documents LIMIT 5;
```

### 2. GitHub Official (`github-official`)
**Status:** ✅ Auto-activated
**Purpose:** GitHub repository management and automation
**Configuration:**
```json
{
  "owner": "PiyushVerma24",
  "repo": "heartfulness-rag-system"
}
```
**Capabilities:**
- Create repositories
- Manage branches and commits
- Handle pull requests
- Repository settings and webhooks

**Usage Example:**
- Create issues
- Push commits
- Manage repository settings

## Optional Servers

These servers are available but not auto-activated. Use them when needed:

### 3. Chrome DevTools (`chrome-devtools`)
**Status:** ⚪ Optional
**Purpose:** Web automation, testing, and debugging
**Capabilities:**
- Browser automation
- Web scraping
- Performance testing
- Screenshot capture
- DOM manipulation

**When to Use:**
- Testing the deployed application
- Debugging UI issues
- Automated testing workflows
- Web scraping for document import

### 4. Miro (`miro`)
**Status:** ⚪ Optional
**Purpose:** Visual planning and collaboration
**Capabilities:**
- Create and manage Miro boards
- Add sticky notes, cards, shapes
- Create visual flowcharts
- Team collaboration diagrams

**When to Use:**
- Planning new features
- System architecture diagrams
- Project management boards
- User flow visualization

## Project Information

### Database Details
- **Host:** db.rmkatiatyikoxhnxsgsw.supabase.co
- **Database:** postgres
- **Port:** 5432
- **User:** postgres
- **Password:** Supabase@2025

### GitHub Repository
- **URL:** https://github.com/PiyushVerma24/heartfulness-rag-system
- **Branch:** main
- **Auto-deploy:** Enabled via Vercel

### Vercel Deployment
- **Project:** app
- **Organization:** piyush-vermas-projects-4a8be759
- **Production URL:** https://app-piyush-vermas-projects-4a8be759.vercel.app
- **Auto-deploy:** Enabled from GitHub main branch

### AI Models
- **Primary:** x-ai/grok-4.1-fast (FREE!)
- **Embedding:** text-embedding-3-small
- **Fallback:** x-ai/grok-4-fast, x-ai/grok-4, google/gemini-2.0-flash-exp:free

## Database Test Scripts

### Test Supabase Connection
```bash
node test-supabase-connection.mjs
```
Returns: Total documents and chunks count

### Check Chunk Schema
```bash
node test-chunk-schema.mjs
```
Returns: All column names and sample chunk data

## Quick Commands

### Deploy to Production
```bash
git add .
git commit -m "Your message"
git push origin main
# Vercel auto-deploys within ~20 seconds
```

### Build Locally
```bash
npm run build
```

### Run Dev Server
```bash
npm run dev
```

## Session Continuity

All MCP server configurations are stored in `.mcp-config.json` and will be automatically loaded at the start of every Claude Code session. No manual configuration needed!

**What Claude Code Knows Automatically:**
- Database connection details
- GitHub repository information
- Vercel deployment settings
- AI model configuration
- All available MCP servers

**No Need to Query or Check:**
- Database connectivity
- Repository settings
- Deployment status
- Available tools

Everything is pre-configured and ready to use! 🚀
