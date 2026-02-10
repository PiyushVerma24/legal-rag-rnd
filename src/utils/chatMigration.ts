import { ChatMessage } from '@/services/chatHistoryService';
import { ChatSession } from '@/types/chatSession';

/**
 * Migrate old single-chat format to new multi-session format
 */
export function migrateOldChatToSessions(userId: string): void {
    const oldKey = `legalrnd_chat_current_${userId}`;
    const oldMessages = localStorage.getItem(oldKey);

    // Check if already migrated
    const sessionsKey = `legalrnd_chat_sessions_${userId}`;
    const existingSessions = localStorage.getItem(sessionsKey);

    if (existingSessions) {
        // Already migrated
        return;
    }

    if (oldMessages) {
        try {
            const messages: ChatMessage[] = JSON.parse(oldMessages);

            if (messages.length > 0) {
                // Create a session from old messages
                const sessionId = `session_${Date.now()}`;
                const session: ChatSession = {
                    id: sessionId,
                    title: messages[0].content.substring(0, 50) + (messages[0].content.length > 50 ? '...' : ''),
                    timestamp: messages[0].timestamp.toString(),
                    messageCount: messages.length,
                    lastMessage: messages[messages.length - 1].content.substring(0, 100),
                    isActive: true
                };

                // Save session metadata
                localStorage.setItem(sessionsKey, JSON.stringify([session]));

                // Save session messages
                const sessionKey = `legalrnd_chat_session_${sessionId}_${userId}`;
                localStorage.setItem(sessionKey, oldMessages);

                // Remove old key
                localStorage.removeItem(oldKey);

                console.log('✅ Migrated old chat to new session format');
            }
        } catch (error) {
            console.error('Failed to migrate old chat:', error);
        }
    } else {
        // No old chat, create empty sessions array
        localStorage.setItem(sessionsKey, JSON.stringify([]));
    }
}
