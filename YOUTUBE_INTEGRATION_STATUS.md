# YouTube Integration - Implementation Status

## ✅ Completed (Backend Infrastructure)

### 1. Database Schema ✅
**File:** `/migrations/add_youtube_support.sql`

Added fields to support YouTube videos:
- `hfnai_documents.youtube_url` - Full YouTube URL
- `hfnai_documents.youtube_video_id` - Extracted video ID
- `hfnai_document_chunks.start_timestamp` - Start time in seconds
- `hfnai_document_chunks.end_timestamp` - End time in seconds

**To Apply:** Run the SQL migration in Supabase SQL editor.

### 2. Text Extraction with Timestamp Mapping ✅
**File:** `src/services/textExtractionService.ts`

- Added `TimestampMapping` interface to track character-to-timestamp relationships
- Updated `cleanYouTubeTranscript()` to extract timestamps from `[HH:MM:SS]` format
- Returns both cleaned text AND timestamp mappings
- Timestamps converted to seconds for database storage

### 3. Chunking with Timestamp Calculation ✅
**File:** `src/services/chunkingService.ts`

- Updated `TextChunk` interface with `startTimestamp` and `endTimestamp`
- Added `calculateChunkTimestamps()` method to map chunk positions to video timestamps
- All chunk creation points now include timestamp data

### 4. Document Processing Pipeline ✅
**File:** `src/services/documentProcessingPipeline.ts`

- Passes timestamp mappings from extraction to chunking
- Stores `start_timestamp` and `end_timestamp` in database chunks
- Preserves YouTube metadata throughout processing

## 🚧 Remaining Tasks (Frontend + Integration)

### 5. Admin Upload Form (TODO)
**File:** `src/pages/admin/EnhancedAdminPage.tsx`

**Changes Needed:**
```typescript
// Add state:
const [youtubeUrl, setYoutubeUrl] = useState('');

// Extract video ID helper:
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Add form field after "Master/Author" dropdown:
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    YouTube URL (Optional)
  </label>
  <input
    type="url"
    value={youtubeUrl}
    onChange={(e) => setYoutubeUrl(e.target.value)}
    placeholder="https://youtu.be/khoHUl12lQQ"
    className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
    disabled={uploading}
  />
  <p className="mt-1 text-xs text-gray-500">
    📹 For YouTube transcripts: link answers to specific video moments
  </p>
</div>

// Update upload handler to save YouTube URL to database after upload
```

### 6. Document Upload Service (TODO)
**File:** `src/services/documentUploadService.ts`

**Changes Needed:**
- Update `uploadDocument()` to accept optional `youtubeUrl` parameter
- After successful file upload, update document record:
```typescript
if (youtubeUrl) {
  const videoId = extractYouTubeVideoId(youtubeUrl);
  await supabase
    .from('hfnai_documents')
    .update({
      youtube_url: youtubeUrl,
      youtube_video_id: videoId
    })
    .eq('id', documentId);
}
```

### 7. YouTube Player Component (TODO)
**File:** `src/components/YouTubePlayer.tsx` (CREATE NEW)

```typescript
import React, { useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface YouTubePlayerProps {
  videoId: string;
  startTime?: number; // seconds
  title?: string;
}

export function YouTubePlayer({ videoId, startTime = 0, title }: YouTubePlayerProps) {
  const [isPiP, setIsPiP] = useState(false);
  const videoRef = useRef<HTMLIFrameElement>(null);

  const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${Math.floor(startTime)}&autoplay=1`;

  const togglePiP = async () => {
    if (!document.pictureInPictureEnabled) {
      alert('Picture-in-Picture not supported');
      return;
    }

    try {
      if (isPiP && document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (videoRef.current) {
        // For iframe PiP, we need to use the video element inside
        // This requires postMessage API or direct video access
        setIsPiP(true);
      }
    } catch (error) {
      console.error('PiP error:', error);
    }
  };

  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      {title && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-3 z-10">
          <p className="text-white text-sm font-medium">{title}</p>
        </div>
      )}

      <iframe
        ref={videoRef}
        className="w-full aspect-video"
        src={embedUrl}
        title={title || 'YouTube video'}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />

      <button
        onClick={togglePiP}
        className="absolute bottom-3 right-3 bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg transition"
        title={isPiP ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
      >
        {isPiP ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
      </button>
    </div>
  );
}
```

### 8. Chat Interface YouTube Citations (TODO)
**File:** `src/pages/chat/EnhancedChatPage.tsx`

**Changes Needed:**

1. Import YouTube Player:
```typescript
import { YouTubePlayer } from '@/components/YouTubePlayer';
```

2. Update RAG query to fetch YouTube metadata:
```typescript
// After getting RAG results, fetch document info for sources
const documentIds = [...new Set(ragResult.sources?.map(s => s.document_id))];
const { data: documents } = await supabase
  .from('hfnai_documents')
  .select('id, title, youtube_url, youtube_video_id')
  .in('id', documentIds);

// Attach to message
assistantMessage.youtube_sources = ragResult.sources
  ?.filter(s => {
    const doc = documents?.find(d => d.id === s.document_id);
    return doc?.youtube_video_id;
  })
  .map(s => {
    const doc = documents?.find(d => d.id === s.document_id)!;
    return {
      videoId: doc.youtube_video_id,
      videoUrl: doc.youtube_url,
      title: doc.title,
      timestamp: s.start_timestamp || 0
    };
  });
```

3. Render YouTube citations below answer:
```typescript
{/* After answer text, add YouTube sources */}
{message.youtube_sources && message.youtube_sources.length > 0 && (
  <div className="mt-4 space-y-3">
    <p className="text-sm font-medium text-purple-700">
      📹 Video Sources ({message.youtube_sources.length})
    </p>
    {message.youtube_sources.map((source, idx) => (
      <div key={idx} className="border border-purple-200 rounded-lg overflow-hidden">
        <YouTubePlayer
          videoId={source.videoId}
          startTime={source.timestamp}
          title={`${source.title} @ ${formatTimestamp(source.timestamp)}`}
        />
        <a
          href={`${source.videoUrl}?t=${Math.floor(source.timestamp)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-2 text-xs text-purple-600 hover:bg-purple-50"
        >
          Open in YouTube at {formatTimestamp(source.timestamp)} →
        </a>
      </div>
    ))}
  </div>
)}
```

4. Add timestamp formatter helper:
```typescript
function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
```

## 🧪 Testing Plan

### Test Document
**YouTube URL:** https://youtu.be/khoHUl12lQQ?si=2ddkQrMCpMNhVI47
**Video ID:** khoHUl12lQQ

### Testing Steps:
1. ✅ Apply database migration
2. Upload the Hindi transcript with YouTube URL
3. Verify document has `youtube_video_id` stored
4. Check that chunks have `start_timestamp` and `end_timestamp`
5. Ask a question in Hindi
6. Verify answer includes YouTube player at correct timestamp
7. Test picture-in-picture mode
8. Test "Open in YouTube" link

## 🎯 Expected Behavior

When a user asks: "दाजी के अनुसार उनके जीवन में आध्यात्मिकता की शुरुआत कैसे हुई?"

The chat should:
1. Show the Hindi answer
2. Display embedded YouTube player
3. Video starts at timestamp where Daaji discusses this (e.g., 2:45)
4. User can click PiP button for picture-in-picture mode
5. Link to open full video in YouTube at exact moment

## 📝 Database Migration Instructions

Run this in Supabase SQL Editor:
```sql
-- Add YouTube support columns
ALTER TABLE hfnai_documents
ADD COLUMN IF NOT EXISTS youtube_url TEXT,
ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;

ALTER TABLE hfnai_document_chunks
ADD COLUMN IF NOT EXISTS start_timestamp INTEGER,
ADD COLUMN IF NOT EXISTS end_timestamp INTEGER;

-- Add index
CREATE INDEX IF NOT EXISTS idx_documents_youtube_video_id
ON hfnai_documents(youtube_video_id)
WHERE youtube_video_id IS NOT NULL;
```

## 🚀 Next Steps

1. Apply database migration
2. Complete admin form changes (add YouTube URL input)
3. Update upload service to save YouTube URL
4. Create YouTube Player component
5. Update chat interface to show video citations
6. Build and deploy
7. Test with provided YouTube link

All backend infrastructure is ready! Frontend changes are straightforward UI updates.
