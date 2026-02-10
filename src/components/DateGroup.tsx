import { useState } from 'react';
import { DateGroup as DateGroupType } from '@/types/chatSession';
import ChatSessionItem from './ChatSessionItem';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface DateGroupProps {
    group: DateGroupType;
    currentSessionId: string | null;
    onSessionSelect: (sessionId: string) => void;
    onSessionDelete: (sessionId: string) => void;
}

export default function DateGroup({
    group,
    currentSessionId,
    onSessionSelect,
    onSessionDelete
}: DateGroupProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="date-group">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-dark-text-secondary hover:text-dark-text-primary transition-colors"
            >
                {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-dark-accent-orange" />
                ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-dark-accent-orange" />
                )}
                <span className="uppercase tracking-wide">{group.label}</span>
                <span className="text-dark-text-muted">({group.sessions.length})</span>
            </button>

            {isExpanded && (
                <div className="space-y-1 mt-1">
                    {group.sessions.map(session => (
                        <ChatSessionItem
                            key={session.id}
                            session={session}
                            isActive={session.id === currentSessionId}
                            onClick={() => onSessionSelect(session.id)}
                            onDelete={(e) => {
                                e.stopPropagation();
                                onSessionDelete(session.id);
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
