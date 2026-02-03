# Heartfulness RAG System - New Features

## Overview
The Heartfulness RAG system has been enhanced with features inspired by the Veritas chat system, providing a comprehensive spiritual learning experience with document selection, chat history, and export capabilities.

---

## 🎯 Key Features Implemented

### 1. **Document Tree Selection Sidebar**
- **Tree Structure by Master**: Documents are organized hierarchically by spiritual Master
  - Babu ji Maharaj (Ram Chandra)
  - Lalaji Maharaj (Ram Chandra of Fatehgarh)
  - Chariji Maharaj (Parthasarathi Rajagopalachari)
  - Daaji (Kamlesh Patel)
  - General (for uncategorized documents)

- **Checkbox Selection**:
  - Select individual documents
  - Select all documents from a specific Master
  - "Select All" button to choose all available literature
  - "Clear All" button to deselect everything

- **Visual Indicators**:
  - Document count per Master
  - Selected document counter
  - Expandable/collapsible tree nodes
  - Partially selected state for Masters (when some but not all documents are selected)

### 2. **Filtered RAG Queries**
- **Document Filtering**: Queries now search only within selected documents
- **Master Filtering**: Can filter by Master even if specific documents aren't selected
- **Smart Fallback**: If no documents are selected, the system prompts users to make a selection
- **Performance**: Filtered queries are faster and more focused

### 3. **Chat History Management**

#### Save Chat Feature
- **Save to Database**: Permanently save chat conversations
- **Custom Titles**: Give chats descriptive titles
- **Metadata Storage**: Saves selected documents and Masters with each chat
- **Auto-save**: Local storage backup of current session

#### Load Chat Feature
- **History Panel**: View all saved chats in a sidebar
- **One-Click Load**: Restore entire conversations with document selections
- **Pinned Chats**: Mark important conversations (future enhancement)
- **Timestamp Display**: See when chats were saved

### 4. **Export & Download Features**

#### PDF Export
- **Full Conversation Export**: Download entire chat as PDF
- **Formatted Output**: Maintains styling and citations
- **High Quality**: 2x scale rendering for crisp text

#### Copy to Clipboard
- **Individual Messages**: Copy any message with one click
- **Visual Feedback**: Checkmark confirmation when copied
- **Preserves Formatting**: Markdown formatting maintained

### 5. **Enhanced UI/UX**

#### Collapsible Sidebar
- **Toggle Button**: Show/hide document tree to maximize chat space
- **Responsive Design**: Adapts to different screen sizes
- **Persistent State**: Remembers sidebar state

#### Citation Display
- **Source Attribution**: Each answer shows which documents were used
- **Relevance Scores**: Similarity percentage for each citation
- **Page Numbers**: Reference specific pages when available
- **Master Attribution**: Shows which Master authored the source

#### Smart Messaging
- **Empty State**: Helpful onboarding message when no chats exist
- **Loading States**: Clear indicators during processing
- **Error Handling**: Graceful error messages with guidance

---

## 🗄️ Database Schema

### New Table: `hfnai_saved_chats`
```sql
CREATE TABLE hfnai_saved_chats (
  id UUID PRIMARY KEY,
  preceptor_id UUID REFERENCES auth.users(id),
  chat_title TEXT,
  messages JSONB,
  ai_model TEXT,
  selected_documents UUID[],
  selected_masters TEXT[],
  is_pinned BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  saved_at TIMESTAMP WITH TIME ZONE
);
```

### Updated Masters Table
- Added "General" master for uncategorized documents

---

## 🔧 Technical Implementation

### New Services

#### 1. **ChatHistoryService**
```typescript
// Location: src/services/chatHistoryService.ts
- saveChat(): Save conversation to database
- loadChats(): Retrieve user's saved chats
- loadChat(): Load specific chat by ID
- updateChat(): Update existing chat
- deleteChat(): Remove chat from database
- Local storage fallback methods
```

#### 2. **DocumentSelectionService**
```typescript
// Location: src/services/documentSelectionService.ts
- getDocumentTree(): Fetch organized document hierarchy
- getDocumentsByMasters(): Filter documents by Master
- getDocumentIdsByMasters(): Get IDs for filtering
- getAllMasters(): List all available Masters
```

### Updated Services

#### **RAGQueryService** (Enhanced)
```typescript
// Now supports:
askQuestion(question, {
  preceptorId,
  selectedDocumentIds,  // NEW: Filter by specific documents
  selectedMasters        // NEW: Filter by Master names
})
```

### New Components

#### 1. **DocumentTreeSelector**
```typescript
// Location: src/components/DocumentTreeSelector.tsx
Features:
- Hierarchical tree view
- Multi-level selection (Master/Document)
- Select All / Clear All
- Real-time selection counter
```

#### 2. **EnhancedChatPage**
```typescript
// Location: src/pages/chat/EnhancedChatPage.tsx
Features:
- Integrated document selector
- Save/load chat functionality
- PDF export
- Copy message functionality
- Chat history panel
- Collapsible sidebar
```

---

## 📦 Dependencies Added

```json
{
  "jspdf": "Latest",          // PDF generation
  "html2canvas": "Latest",    // HTML to canvas conversion
  "dompurify": "Latest",      // HTML sanitization
  "remark-gfm": "Latest"      // GitHub Flavored Markdown support
}
```

---

## 🚀 How to Use

### For Preceptors

1. **Start a New Chat**:
   - Navigate to `/chat`
   - Open the document selector sidebar (if hidden)
   - Select literature you want to query
   - Type your question and click "Ask"

2. **Select Literature**:
   - **Option A**: Click individual documents
   - **Option B**: Click Master checkbox to select all their works
   - **Option C**: Use "Select All" to query entire library
   - **Option D**: Mix and match Masters and documents

3. **Save Important Conversations**:
   - Click the Save icon in the header
   - Give your chat a meaningful title
   - Chat is saved with selected documents
   - Access later from History panel

4. **Export Conversations**:
   - Click Download icon for PDF export
   - Click Copy button on individual messages
   - Share insights with others

5. **Load Previous Chats**:
   - Click History icon to open saved chats panel
   - Click any chat to load it
   - Document selections are restored automatically

### For Administrators

1. **Upload Documents**:
   - Navigate to `/admin`
   - Select Master from dropdown (or "General" for uncategorized)
   - Upload PDF, EPUB, or TXT files
   - Documents are automatically processed and added to the tree

2. **Database Setup**:
   ```bash
   # Run the migration to create saved_chats table
   # This needs to be done in Supabase SQL editor
   # File: supabase/migrations/20250130000000_create_saved_heartfulness_chats.sql
   ```

---

## 🎨 UI Design Highlights

### Color Scheme
- **Primary**: Purple gradients (spiritual theme)
- **User Messages**: Purple background with white text
- **Assistant Messages**: White with purple accents
- **Sidebar**: Light purple gradients

### Responsive Design
- **Desktop**: Full sidebar with chat area
- **Tablet**: Collapsible sidebar
- **Mobile**: Full-screen chat with overlay sidebar

### Accessibility
- Clear visual hierarchy
- Color-blind friendly indicators
- Keyboard navigation support
- Screen reader friendly

---

## 🔒 Security & Privacy

### Row Level Security (RLS)
- Users can only see their own saved chats
- Preceptor ID validation on all operations
- Secure authentication required

### Data Sanitization
- DOMPurify for HTML safety
- Input validation on all queries
- XSS protection

---

## 🔄 Data Flow

### Query Flow
```
User Input → Document Selection → RAG Service
     ↓
Filter by Selected Documents
     ↓
Vector Search in Supabase
     ↓
LLM Generation with Context
     ↓
Response with Citations
     ↓
Display to User + Auto-save
```

### Save Flow
```
Chat Messages → ChatHistoryService
     ↓
Format with Metadata
     ↓
Save to hfnai_saved_chats table
     ↓
Update Local State
     ↓
Show in History Panel
```

---

## 📊 Performance Optimizations

1. **Filtered Queries**: Only search selected documents (faster results)
2. **Lazy Loading**: Document tree loads on demand
3. **Local Storage**: Quick access to current session
4. **Debounced Search**: Prevents excessive API calls
5. **Optimized PDF Export**: High quality with reasonable file sizes

---

## 🐛 Known Limitations & Future Enhancements

### Current Limitations
1. PDF export requires good network connection
2. Very large chats (100+ messages) may have slower export times
3. Chat search within history panel not yet implemented

### Planned Enhancements
1. **Advanced Filtering**: Date ranges, Master combinations
2. **Chat Search**: Full-text search across saved chats
3. **Pin/Favorite**: Mark important chats for quick access
4. **Share Chats**: Generate shareable links
5. **Export Options**: Word, Markdown, plain text
6. **Voice Input**: Speech-to-text for questions
7. **Multi-language**: Support for regional languages

---

## 📝 Migration Guide (For Database Admins)

### Step 1: Run Migration
```sql
-- In Supabase SQL Editor:
-- Copy content from:
-- supabase/migrations/20250130000000_create_saved_heartfulness_chats.sql
-- Execute the entire script
```

### Step 2: Verify Tables
```sql
-- Check if table exists
SELECT * FROM hfnai_saved_chats LIMIT 1;

-- Verify RLS policies
SELECT * FROM pg_policies WHERE tablename = 'hfnai_saved_chats';

-- Check if "General" master was created
SELECT * FROM hfnai_masters WHERE name = 'General';
```

### Step 3: Test
1. Save a test chat
2. Load the test chat
3. Verify document selections restored correctly

---

## 🤝 Contributing

### Adding New Features
1. Follow existing service patterns
2. Add TypeScript types
3. Update this documentation
4. Test with real data

### Code Organization
```
src/
├── components/
│   └── DocumentTreeSelector.tsx    # Document selection UI
├── services/
│   ├── chatHistoryService.ts       # Chat save/load
│   ├── documentSelectionService.ts # Document tree
│   └── ragQueryService.ts          # Enhanced with filtering
└── pages/
    └── chat/
        └── EnhancedChatPage.tsx    # Main chat interface
```

---

## 📞 Support

For issues or questions:
1. Check console logs for errors
2. Verify database migrations ran successfully
3. Ensure user is authenticated
4. Check network tab for failed requests

---

## ✨ Summary

The Heartfulness RAG system now provides a comprehensive, user-friendly interface for exploring spiritual teachings with:
- ✅ Organized document library
- ✅ Flexible document selection
- ✅ Persistent chat history
- ✅ Professional export options
- ✅ Intuitive user experience

All features are production-ready and follow best practices for React, TypeScript, and Supabase development.

---

**Last Updated**: January 30, 2025
**Version**: 2.0
**Author**: Claude Code (Anthropic)
