// Chat session types
export interface ChatSession {
    id: string;
    title: string;
    timestamp: string;
    messageCount: number;
    lastMessage: string;
    isActive: boolean;
}

export interface DateGroup {
    label: string;
    sessions: ChatSession[];
}
