import { ChatSession } from '@/types/chatSession';
import { groupSessionsByDate } from '@/utils/dateGrouping';
import DateGroup from './DateGroup';
import { Plus, History, MessageSquare } from 'lucide-react';

interface ChatHistorySidebarProps {
    userId: string;
    sessions: ChatSession[];
    currentSessionId: string | null;
    onSessionSelect: (sessionId: string) => void;
    onNewChat: () => void;
    onSessionDelete: (sessionId: string) => void;
}

export default function ChatHistorySidebar({
    sessions,
    currentSessionId,
    onSessionSelect,
    onNewChat,
    onSessionDelete
}: ChatHistorySidebarProps) {
    const dateGroups = groupSessionsByDate(sessions);

    return (
        <div className="chat-history-sidebar flex flex-col h-full bg-dark-bg-secondary border-r border-dark-border-primary">
            {/* New Chat Section */}
            <div className="p-4 border-b border-dark-border-primary bg-dark-bg-secondary">
                <button
                    onClick={onNewChat}
                    className="w-full px-3 py-2 text-sm bg-dark-accent-orange text-white rounded-md hover:bg-dark-accent-orangeHover transition flex items-center justify-center gap-2 font-medium shadow-sm"
                >
                    <Plus className="h-4 w-4" />
                    New Chat
                </button>
            </div>

            {/* History Header */}
            <div className="px-4 pt-4 pb-2 bg-dark-bg-secondary">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-dark-text-primary flex items-center gap-2">
                        <History className="h-4 w-4 text-dark-accent-orange" />
                        Chat History
                    </h3>
                    <span className="text-xs text-dark-text-muted bg-dark-bg-elevated px-2 py-0.5 rounded-full border border-dark-border-primary">
                        {sessions.length}
                    </span>
                </div>
            </div>

            {/* Chat Sessions List */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-4 scrollbar-thin">
                {dateGroups.length === 0 ? (
                    <div className="text-center py-8 text-dark-text-muted">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 text-dark-bg-elevated" />
                        <p className="text-sm">No chat history yet.</p>
                        <p className="text-xs mt-1">Start a new conversation!</p>
                    </div>
                ) : (
                    dateGroups.map(group => (
                        <DateGroup
                            key={group.label}
                            group={group}
                            currentSessionId={currentSessionId}
                            onSessionSelect={onSessionSelect}
                            onSessionDelete={onSessionDelete}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
