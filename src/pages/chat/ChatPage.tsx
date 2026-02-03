import { useState } from 'react';
import { RAGQueryService } from '@/services/ragQueryService';
import ReactMarkdown from 'react-markdown';

export default function ChatPage() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const ragService = new RAGQueryService();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const userMessage = { role: 'user', content: question };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setQuestion('');

    const response = await ragService.askQuestion(question);

    const assistantMessage = {
      role: 'assistant',
      content: response.success ? response.answer : response.message,
      citations: response.citations || []
    };

    setMessages(prev => [...prev, assistantMessage]);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="spiritual-card p-4">
        <h1 className="text-2xl font-bold text-purple-800">🕉️ Heartfulness Wisdom</h1>
        <p className="text-gray-600">Ask questions about spiritual teachings and meditation</p>
      </header>

      <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
        <div className="space-y-4 mb-20">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-purple-600 text-white' 
                  : 'spiritual-card'
              }`}>
                <ReactMarkdown className="prose prose-sm">{msg.content}</ReactMarkdown>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-purple-200">
                    <p className="text-xs font-semibold mb-2">Sources:</p>
                    {msg.citations.map((cite: any, i: number) => (
                      <p key={i} className="text-xs text-gray-600">
                        [{i + 1}] {cite.document_title} by {cite.master_name}, p.{cite.page_number}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="spiritual-card p-4">
                <p className="text-gray-600">Searching sacred texts...</p>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-sm border-t border-purple-100">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about meditation, spirituality, or the Masters' teachings..."
            className="flex-1 px-4 py-3 rounded-lg border border-purple-200 focus:outline-none focus:border-purple-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="spiritual-button disabled:opacity-50"
          >
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </form>
      </footer>
    </div>
  );
}
