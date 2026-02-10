import { ChatSession, DateGroup } from '@/types/chatSession';

/**
 * Group chat sessions by date ranges
 */
export function groupSessionsByDate(sessions: ChatSession[]): DateGroup[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);

    const groups: DateGroup[] = [
        { label: "Today", sessions: [] },
        { label: "Yesterday", sessions: [] },
        { label: "Last 7 Days", sessions: [] },
        { label: "Last 30 Days", sessions: [] },
        { label: "Older", sessions: [] }
    ];

    sessions.forEach(session => {
        const sessionDate = new Date(session.timestamp);

        if (sessionDate >= today) {
            groups[0].sessions.push(session);
        } else if (sessionDate >= yesterday) {
            groups[1].sessions.push(session);
        } else if (sessionDate >= last7Days) {
            groups[2].sessions.push(session);
        } else if (sessionDate >= last30Days) {
            groups[3].sessions.push(session);
        } else {
            groups[4].sessions.push(session);
        }
    });

    // Filter out empty groups
    return groups.filter(g => g.sessions.length > 0);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: string): string {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
}
