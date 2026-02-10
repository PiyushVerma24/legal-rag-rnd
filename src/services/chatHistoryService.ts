import { supabase } from '@/lib/supabase';
import { ChatSession } from '@/types/chatSession';

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
  // New fields for LLM Response display
  rawResponse?: string;
  tokenUsage?: {
    embeddingTokens: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    grandTotal: number;
  };
  estimatedCost?: number;
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
  lawyer_id: string;
  preceptor_id?: string; // Backward compatibility
  title: string;
  messages: ChatMessage[];
  selected_document_ids?: string[];
  is_pinned?: boolean;
  saved_at?: string;
  created_at?: string;
  updated_at?: string;
}

export class ChatHistoryService {
  /**
   * ========================================
   * SESSION MANAGEMENT METHODS (NEW)
   * ========================================
   */

  /**
   * Get all chat sessions for a user
   */
  getChatSessions(userId: string): ChatSession[] {
    try {
      const key = `legalrnd_chat_sessions_${userId}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      return [];
    }
  }

  /**
   * Create a new chat session
   */
  createChatSession(userId: string): ChatSession {
    const sessionId = `session_${Date.now()}`;
    const session: ChatSession = {
      id: sessionId,
      title: "New Chat",
      timestamp: new Date().toISOString(),
      messageCount: 0,
      lastMessage: "",
      isActive: true
    };

    const sessions = this.getChatSessions(userId);

    // Mark all others as inactive
    sessions.forEach(s => s.isActive = false);

    // Add new session at the beginning
    sessions.unshift(session);

    // Save
    const key = `legalrnd_chat_sessions_${userId}`;
    localStorage.setItem(key, JSON.stringify(sessions));

    return session;
  }

  /**
   * Load messages for a specific session
   */
  loadSessionMessages(userId: string, sessionId: string): ChatMessage[] {
    try {
      const key = `legalrnd_chat_session_${sessionId}_${userId}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading session messages:', error);
      return [];
    }
  }

  /**
   * Save messages for a specific session
   */
  saveSessionMessages(userId: string, sessionId: string, messages: ChatMessage[]): void {
    try {
      const key = `legalrnd_chat_session_${sessionId}_${userId}`;
      localStorage.setItem(key, JSON.stringify(messages));

      // Update session metadata
      this.updateSessionMetadata(userId, sessionId, messages);
    } catch (error) {
      console.error('Error saving session messages:', error);
    }
  }

  /**
   * Update session metadata (title, message count, last message)
   */
  updateSessionMetadata(userId: string, sessionId: string, messages: ChatMessage[]): void {
    try {
      const sessions = this.getChatSessions(userId);
      const session = sessions.find(s => s.id === sessionId);

      if (session && messages.length > 0) {
        session.title = messages[0].content.substring(0, 50) + (messages[0].content.length > 50 ? '...' : '');
        session.messageCount = messages.length;
        session.lastMessage = messages[messages.length - 1].content.substring(0, 100);
        session.timestamp = messages[messages.length - 1].timestamp.toString();

        const key = `legalrnd_chat_sessions_${userId}`;
        localStorage.setItem(key, JSON.stringify(sessions));
      }
    } catch (error) {
      console.error('Error updating session metadata:', error);
    }
  }

  /**
   * Set active session
   */
  setActiveSession(userId: string, sessionId: string): void {
    try {
      const sessions = this.getChatSessions(userId);
      sessions.forEach(s => s.isActive = (s.id === sessionId));

      const key = `legalrnd_chat_sessions_${userId}`;
      localStorage.setItem(key, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error setting active session:', error);
    }
  }

  /**
   * Delete a chat session
   */
  deleteSession(userId: string, sessionId: string): void {
    try {
      // Remove session messages
      const sessionKey = `legalrnd_chat_session_${sessionId}_${userId}`;
      localStorage.removeItem(sessionKey);

      // Remove from sessions list
      let sessions = this.getChatSessions(userId);
      sessions = sessions.filter(s => s.id !== sessionId);

      const key = `legalrnd_chat_sessions_${userId}`;
      localStorage.setItem(key, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  /**
   * ========================================
   * LEGACY METHODS (EXISTING)
   * ========================================
   */

  /**
   * Save chat to local storage (fallback/temporary storage)
   */
  saveToLocalStorage(key: string, messages: ChatMessage[]): void {
    try {
      localStorage.setItem(`legalrnd_chat_${key}`, JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving to local storage:', error);
    }
  }

  /**
   * Load chat from local storage
   */
  loadFromLocalStorage(key: string): ChatMessage[] | null {
    try {
      const data = localStorage.getItem(`legalrnd_chat_${key}`);
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
      localStorage.removeItem(`legalrnd_chat_${key}`);
    } catch (error) {
      console.error('Error clearing local storage:', error);
    }
  }

  /**
   * ========================================
   * DATABASE METHODS (LEGACY - FOR SAVED CHATS)
   * ========================================
   */

  /**
   * Load all saved chats for a lawyer
   */
  async loadChats(
    lawyerId: string,
    options: {
      pinnedOnly?: boolean;
      limit?: number;
    } = {}
  ): Promise<{ success: boolean; chats?: SavedChat[]; error?: string }> {
    try {
      let query = supabase
        .from('legalrnd_saved_chats')
        .select('*')
        .eq('lawyer_id', lawyerId)
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
   * Save a chat to the database
   */
  async saveChat(chat: {
    title: string;
    lawyerId: string;
    messages: ChatMessage[];
    selectedDocumentIds?: string[];
  }): Promise<{ success: boolean; chatId?: string; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('legalrnd_saved_chats')
        .insert({
          title: chat.title,
          lawyer_id: chat.lawyerId,
          conversation: chat.messages,
          selected_document_ids: chat.selectedDocumentIds || [],
          is_pinned: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
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
   * Load a specific chat by ID
   */
  async loadChat(chatId: string): Promise<{ success: boolean; chat?: SavedChat; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('legalrnd_saved_chats')
        .select('*')
        .eq('id', chatId)
        .single();

      if (error) throw error;

      // Parse messages from JSONB
      const chat: SavedChat = {
        ...data,
        messages: typeof data.messages === 'string'
          ? JSON.parse(data.messages)
          : data.messages
      };

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
   * Delete a saved chat
   */
  async deleteChat(chatId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('legalrnd_saved_chats')
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
   * Toggle pin status of a chat
   */
  async updateChatPin(chatId: string, isPinned: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('legalrnd_saved_chats')
        .update({ is_pinned: isPinned })
        .eq('id', chatId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error updating chat pin:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
