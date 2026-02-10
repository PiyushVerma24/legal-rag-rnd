import { ChatSession } from '@/types/chatSession';
import { formatRelativeTime } from '@/utils/dateGrouping';
import { Trash2, MessageSquare } from 'lucide-react';

interface ChatSessionItemProps {
    session: ChatSession;
    isActive: boolean;
    onClick: () => void;
    onDelete?: (e: React.MouseEvent) => void;
}

export default function ChatSessionItem({
    session,
    isActive,
    onClick,
    onDelete
}: ChatSessionItemProps) {
    return (
        <div
            onClick={onClick}
            className={`
        chat-session-item group
        px-3 py-2.5 rounded-lg cursor-pointer transition-all
        border border-transparent
        ${isActive
                    ? 'bg-dark-bg-elevated border-dark-border-primary'
                    : 'hover:bg-dark-bg-elevated/50'
                }
      `}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-dark-accent-orange' : 'text-dark-text-muted'}`} />
                        <h4 className={`text-sm font-medium truncate ${isActive ? 'text-dark-text-primary' : 'text-dark-text-secondary group-hover:text-dark-text-primary'}`}>
                            {session.title}
                        </h4>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-dark-text-muted">
                        <span>{formatRelativeTime(session.timestamp)}</span>
                        <span>•</span>
                        <span>{session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}</span>
                    </div>
                </div>

                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-900/30 rounded"
                        title="Delete chat"
                    >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                )}
            </div>
        </div>
    );
}
