import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: Citation[];
  summary?: string;
  reading_time?: {
    summary: string;
    detail: string;
  };
  aiModel?: string;
  debug?: {
    systemPrompt: string;
    userPrompt: string;
  };
}

export interface Citation {
  document_id: string; // For tracking and linking
  document_title: string;
  master_name: string;
  page_number?: number;
  chunk_id: string;
  quote: string; // Short preview (200 chars)
  full_content: string; // Full chunk content for modal/expansion
  similarity?: number;
  position_in_document?: number; // Order/sequence in original document
  chapter?: string; // If available in metadata
  youtube_video_id?: string; // YouTube video ID for embedding
  start_timestamp?: number; // Video timestamp in seconds
  end_timestamp?: number; // Video end timestamp in seconds
}

export interface SavedChat {
  id: string;
  preceptor_id: string;
  chat_title?: string;
  messages: ChatMessage[];
  ai_model?: string;
  selected_documents?: string[];
  selected_masters?: string[];
  is_pinned: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  saved_at: string;
}

export class ChatHistoryService {
  /**
   * Save a chat conversation to the database
   */
  async saveChat(
    preceptorId: string,
    messages: ChatMessage[],
    options: {
      chatTitle?: string;
      aiModel?: string;
      selectedDocuments?: string[];
      selectedMasters?: string[];
      isPinned?: boolean;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{ success: boolean; chatId?: string; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('hfnai_saved_chats')
        .insert({
          preceptor_id: preceptorId,
          chat_title: options.chatTitle || `Chat ${new Date().toLocaleDateString()}`,
          messages: JSON.stringify(messages),
          ai_model: options.aiModel,
          selected_documents: options.selectedDocuments || [],
          selected_masters: options.selectedMasters || [],
          is_pinned: options.isPinned || false,
          metadata: options.metadata || {},
          saved_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;

      return {
        success: true,
        chatId: data.id
      };
    } catch (error) {
      console.error('Error saving chat:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Load all saved chats for a preceptor
   */
  async loadChats(
    preceptorId: string,
    options: {
      pinnedOnly?: boolean;
      limit?: number;
    } = {}
  ): Promise<{ success: boolean; chats?: SavedChat[]; error?: string }> {
    try {
      let query = supabase
        .from('hfnai_saved_chats')
        .select('*')
        .eq('preceptor_id', preceptorId)
        .order('saved_at', { ascending: false });

      if (options.pinnedOnly) {
        query = query.eq('is_pinned', true);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Parse messages from JSONB
      const chats = data.map(chat => ({
        ...chat,
        messages: typeof chat.messages === 'string'
          ? JSON.parse(chat.messages)
          : chat.messages
      })) as SavedChat[];

      return {
        success: true,
        chats
      };
    } catch (error) {
      console.error('Error loading chats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Load a specific chat by ID
   */
  async loadChat(chatId: string): Promise<{ success: boolean; chat?: SavedChat; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('hfnai_saved_chats')
        .select('*')
        .eq('id', chatId)
        .single();

      if (error) throw error;

      // Parse messages from JSONB
      const chat = {
        ...data,
        messages: typeof data.messages === 'string'
          ? JSON.parse(data.messages)
          : data.messages
      } as SavedChat;

      return {
        success: true,
        chat
      };
    } catch (error) {
      console.error('Error loading chat:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update a saved chat
   */
  async updateChat(
    chatId: string,
    updates: {
      chatTitle?: string;
      messages?: ChatMessage[];
      isPinned?: boolean;
      metadata?: Record<string, any>;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.chatTitle !== undefined) {
        updateData.chat_title = updates.chatTitle;
      }

      if (updates.messages !== undefined) {
        updateData.messages = JSON.stringify(updates.messages);
      }

      if (updates.isPinned !== undefined) {
        updateData.is_pinned = updates.isPinned;
      }

      if (updates.metadata !== undefined) {
        updateData.metadata = updates.metadata;
      }

      const { error } = await supabase
        .from('hfnai_saved_chats')
        .update(updateData)
        .eq('id', chatId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error updating chat:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete a saved chat
   */
  async deleteChat(chatId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('hfnai_saved_chats')
        .delete()
        .eq('id', chatId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error deleting chat:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Save chat to local storage (fallback/temporary storage)
   */
  saveToLocalStorage(key: string, messages: ChatMessage[]): void {
    try {
      localStorage.setItem(`hfnai_chat_${key}`, JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving to local storage:', error);
    }
  }

  /**
   * Load chat from local storage
   */
  loadFromLocalStorage(key: string): ChatMessage[] | null {
    try {
      const data = localStorage.getItem(`hfnai_chat_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading from local storage:', error);
      return null;
    }
  }

  /**
   * Clear local storage chat
   */
  clearLocalStorage(key: string): void {
    try {
      localStorage.removeItem(`hfnai_chat_${key}`);
    } catch (error) {
      console.error('Error clearing local storage:', error);
    }
  }
}
