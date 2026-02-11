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
   * Get all chat sessions for a user (Async)
   */
  async getChatSessions(userId: string): Promise<ChatSession[]> {
    try {
      // Fetch from Supabase
      const { data, error } = await supabase
        .from('legalrnd_saved_chats')
        .select('id, title, updated_at, conversation')
        .eq('lawyer_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Map to ChatSession format
      // Note: We don't persist 'isActive' in DB. UI handles it via selected ID.
      return data.map(chat => {
        const messages = typeof chat.conversation === 'string'
          ? JSON.parse(chat.conversation)
          : chat.conversation as ChatMessage[];

        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

        return {
          id: chat.id,
          title: chat.title,
          timestamp: chat.updated_at,
          messageCount: messages.length,
          lastMessage: lastMsg ? (lastMsg.content.substring(0, 100) + (lastMsg.content.length > 100 ? '...' : '')) : '',
          isActive: false
        };
      });

      // OLD LOCAL STORAGE CODE (Commented out)
      /*
      const key = `legalrnd_chat_sessions_${userId}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
      */
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      return [];
    }
  }

  /**
   * Create a new chat session (Async)
   */
  async createChatSession(userId: string): Promise<ChatSession> {
    const defaultTitle = "New Chat";
    const timestamp = new Date().toISOString();

    try {
      // Insert into Supabase
      const { data, error } = await supabase
        .from('legalrnd_saved_chats')
        .insert({
          lawyer_id: userId,
          title: defaultTitle,
          conversation: [],
          updated_at: timestamp
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        title: data.title,
        timestamp: data.updated_at,
        messageCount: 0,
        lastMessage: "",
        isActive: true
      };
    } catch (error) {
      console.error('Error creating chat session:', error);
      return {
        id: crypto.randomUUID(), // Use valid UUID so it doesn't fail Postgres validation if we try to use it later
        title: defaultTitle,
        timestamp: timestamp,
        messageCount: 0,
        lastMessage: "Error creating session (Local)",
        isActive: true
      };
    }

    // OLD LOCAL STORAGE CODE (Commented out)
    /*
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
    */
  }

  /**
   * Load messages for a specific session (Async)
   */
  async loadSessionMessages(_userId: string, sessionId: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('legalrnd_saved_chats')
        .select('conversation')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      if (data && data.conversation) {
        return typeof data.conversation === 'string'
          ? JSON.parse(data.conversation)
          : data.conversation;
      }
      return [];

      // OLD LOCAL STORAGE CODE (Commented out)
      /*
      const key = `legalrnd_chat_session_${sessionId}_${userId}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
      */
    } catch (error) {
      console.error('Error loading session messages:', error);
      return [];
    }
  }

  /**
   * Save messages for a specific session (Async)
   */
  async saveSessionMessages(_userId: string, sessionId: string, messages: ChatMessage[]): Promise<void> {
    try {
      // Prepare update data
      const updateData: any = {
        conversation: messages,
        updated_at: new Date().toISOString()
      };

      // Auto-update title if it's the first message or specific conditionsmet
      if (messages.length > 0) {
        const firstMsg = messages[0];
        // Simple title logic: First 50 chars of first message
        const newTitle = firstMsg.content.substring(0, 50) + (firstMsg.content.length > 50 ? '...' : '');
        updateData.title = newTitle;
      }

      // Use UPSERT to handle cases where session might not exist (e.g. created locally/offline first)
      // or if it was a "temp" session that we now want to persist.
      const { error } = await supabase
        .from('legalrnd_saved_chats')
        .upsert({
          id: sessionId,
          lawyer_id: _userId, // Ensure we pass the owner ID
          ...updateData
        }, { onConflict: 'id' });

      if (error) throw error;

      // OLD LOCAL STORAGE CODE (Commented out)
      /*
      const key = `legalrnd_chat_session_${sessionId}_${userId}`;
      localStorage.setItem(key, JSON.stringify(messages));

      // Update session metadata
      this.updateSessionMetadata(userId, sessionId, messages);
      */
    } catch (error) {
      console.error('Error saving session messages:', error);
    }
  }

  // Helper method removed or commented out as logic is now inside saveSessionMessages/Supabase trigger
  /*
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
  */

  /**
   * Set active session (Async/No-op for DB, implementation detail for UI)
   * The DB doesn't track "active" state, the UI does. 
   * We keep this method signature but make it do nothing or just update local state if needed.
   */
  setActiveSession(_userId: string, _sessionId: string): void {
    // This is now purely UI state management, no persistence needed for "active" flag in DB
    // OLD LOCAL STORAGE CODE (Commented out)
    /*
    try {
      const sessions = this.getChatSessions(userId);
      sessions.forEach(s => s.isActive = (s.id === sessionId));

      const key = `legalrnd_chat_sessions_${userId}`;
      localStorage.setItem(key, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error setting active session:', error);
    }
    */
  }

  /**
   * Delete a chat session (Async)
   */
  async deleteSession(_userId: string, sessionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('legalrnd_saved_chats')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      // OLD LOCAL STORAGE CODE (Commented out)
      /*
      // Remove session messages
      const sessionKey = `legalrnd_chat_session_${sessionId}_${userId}`;
      localStorage.removeItem(sessionKey);

      // Remove from sessions list
      let sessions = this.getChatSessions(userId);
      sessions = sessions.filter(s => s.id !== sessionId);

      const key = `legalrnd_chat_sessions_${userId}`;
      localStorage.setItem(key, JSON.stringify(sessions));
      */
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  /**
   * Migrate LocalStorage Sessions to DB
   */
  async migrateLocalSessionsToDb(userId: string): Promise<void> {
    try {
      const key = `legalrnd_chat_sessions_${userId}`;
      const data = localStorage.getItem(key);
      const sessions: ChatSession[] = data ? JSON.parse(data) : [];

      if (sessions.length === 0) return;

      console.log(`Starting migration of ${sessions.length} local sessions to DB...`);

      for (const session of sessions) {
        // Check if already exists (optional, but good for idempotency)
        // For now, simpler to just try insert.

        // Load messages for this session
        const msgKey = `legalrnd_chat_session_${session.id}_${userId}`;
        const msgData = localStorage.getItem(msgKey);
        const messages = msgData ? JSON.parse(msgData) : [];

        if (messages.length === 0 && !session.title) continue; // Skip empty zombies

        // Insert into DB
        const { error } = await supabase
          .from('legalrnd_saved_chats')
          .insert({
            lawyer_id: userId,
            title: session.title || "Migrated Chat",
            conversation: messages,
            updated_at: session.timestamp || new Date().toISOString()
            // We let ID be auto-generated or we could try to preserve it if it's a valid UUID.
            // Local IDs are usually 'session_123456...', not UUIDs. So we let DB generate new UUIDs.
          });

        if (!error) {
          // Cleanup local storage for this session after successful migration
          // localStorage.removeItem(msgKey);
          console.log(`Migrated session: ${session.title}`);
        } else {
          console.error(`Failed to migrate session ${session.id}:`, error);
        }
      }

      // Finally, rename/clear the sessions list key to prevent re-migration
      // localStorage.removeItem(key);
      // Or rename it to indicate it's done
      localStorage.setItem(`${key}_migrated`, 'true');
      localStorage.removeItem(key);
      console.log('Migration completed.');

    } catch (error) {
      console.error('Error during migration:', error);
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
