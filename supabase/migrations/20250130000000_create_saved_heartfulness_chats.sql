-- Create table for saved Heartfulness chat conversations
CREATE TABLE IF NOT EXISTS hfnai_saved_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preceptor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_title TEXT, -- Optional title for the saved chat
  messages JSONB NOT NULL, -- Array of chat messages
  ai_model TEXT, -- Model used (e.g., 'google/gemini-2.0-flash-exp:free')
  selected_documents UUID[], -- Array of document IDs that were selected for this chat
  selected_masters TEXT[], -- Array of master names that were selected
  is_pinned BOOLEAN DEFAULT FALSE, -- Whether this chat is pinned/favorite
  metadata JSONB DEFAULT '{}', -- Additional metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', NOW()),
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', NOW()) -- When user explicitly saved this chat
);

-- Enable RLS
ALTER TABLE hfnai_saved_chats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Preceptors can view their own saved chats"
  ON hfnai_saved_chats FOR SELECT
  USING (auth.uid() = preceptor_id);

CREATE POLICY "Preceptors can insert their own saved chats"
  ON hfnai_saved_chats FOR INSERT
  WITH CHECK (auth.uid() = preceptor_id);

CREATE POLICY "Preceptors can update their own saved chats"
  ON hfnai_saved_chats FOR UPDATE
  USING (auth.uid() = preceptor_id)
  WITH CHECK (auth.uid() = preceptor_id);

CREATE POLICY "Preceptors can delete their own saved chats"
  ON hfnai_saved_chats FOR DELETE
  USING (auth.uid() = preceptor_id);

-- Indexes for better performance
CREATE INDEX idx_hfnai_saved_chats_preceptor_id ON hfnai_saved_chats(preceptor_id);
CREATE INDEX idx_hfnai_saved_chats_created_at ON hfnai_saved_chats(created_at DESC);
CREATE INDEX idx_hfnai_saved_chats_is_pinned ON hfnai_saved_chats(preceptor_id, is_pinned) WHERE is_pinned = TRUE;

-- Add comment
COMMENT ON TABLE hfnai_saved_chats IS 'Stores saved Heartfulness RAG chat conversations with AI model and document selection information';

-- Add 'General' master for uncategorized documents (if it doesn't exist)
INSERT INTO hfnai_masters (name, description)
SELECT
  'General',
  'General spiritual texts and documents not attributed to a specific Master'
WHERE NOT EXISTS (
  SELECT 1 FROM hfnai_masters WHERE name = 'General'
);
