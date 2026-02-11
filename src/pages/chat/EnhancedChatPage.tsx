import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RAGQueryService } from '@/services/ragQueryService';
import { ChatHistoryService, ChatMessage } from '@/services/chatHistoryService';
import { supabase } from '@/lib/supabase';
import DocumentTreeSelector from '@/components/DocumentTreeSelector';
import SourceCitation from '@/components/SourceCitation';
import AccordionSection from '@/components/AccordionSection';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Send,
  BookOpen,
  Save,
  Download,
  Copy,
  Check,
  Loader2,
  Trash2,
  Pin,
  History,
  LogOut,
  Code,
  FileText,
  AlignLeft,
  Mic,
  MicOff
} from 'lucide-react';
import { toast } from 'sonner';
import { ChatSession } from '@/types/chatSession';

import ChatHistorySidebar from '@/components/ChatHistorySidebar';

export default function EnhancedChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [chatTitle, setChatTitle] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [savedChats, setSavedChats] = useState<any[]>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugData, setDebugData] = useState<{ systemPrompt: string; userPrompt: string } | null>(null);
  const [isListening, setIsListening] = useState(false);
  // New state for LLM Response modal and session cost tracking
  const [showLLMResponseModal, setShowLLMResponseModal] = useState(false);
  const [llmResponseData, setLLMResponseData] = useState<{
    rawResponse: string;
    tokenUsage: {
      embeddingTokens: number;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      grandTotal: number;
    };
    estimatedCost: number;
    aiModel?: string;
  } | null>(null);
  const [sessionCost, setSessionCost] = useState<number>(0);
  const [recognition, setRecognition] = useState<any>(null);
  // Chat session state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const ragService = new RAGQueryService();
  const chatHistoryService = new ChatHistoryService();

  useEffect(() => {
    // Clean up old shared localStorage key (PRIVACY FIX - migration)
    const oldSharedChat = localStorage.getItem('hfnai_chat_current');
    if (oldSharedChat) {
      console.log('🧹 Removing old shared chat data for privacy compliance');
      localStorage.removeItem('hfnai_chat_current');
    }

    loadUser();
    initializeSpeechRecognition();
  }, []);

  const initializeSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsListening(false);
      };

      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        toast.error('Could not recognize speech. Please try again.');
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }
  };

  const toggleVoiceInput = () => {
    if (!recognition) {
      toast.error('Speech recognition not supported in your browser');
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      try {
        recognition.start();
        setIsListening(true);
        toast.info('Listening... Speak now');
      } catch (error) {
        console.error('Error starting recognition:', error);
        toast.error('Failed to start voice input');
      }
    }
  };



  // Auto-save messages to current session
  useEffect(() => {
    const saveMessages = async () => {
      if (currentUser && currentSessionId && messages.length > 0) {
        // Use email for RLS policy match, fallback to ID for default user
        const userId = currentUser.email || currentUser.id;
        await chatHistoryService.saveSessionMessages(userId, currentSessionId, messages);

        // Update the session list specifically to refresh "last message" and timestamp
        // This ensures the sidebar stays in sync with the live chat
        const updatedSessions = await chatHistoryService.getChatSessions(userId);
        setChatSessions(updatedSessions);
      }
    };
    saveMessages();
  }, [messages, currentUser, currentSessionId]);

  // Persist session cost to localStorage
  useEffect(() => {
    if (currentUser && sessionCost > 0) {
      localStorage.setItem(`legalrnd_session_cost_${currentUser.id}`, sessionCost.toString());
    }
  }, [sessionCost, currentUser]);

  // Initialize chat sessions when user changes
  useEffect(() => {
    const initSessions = async () => {
      if (currentUser) {
        // Use email for RLS policy match
        const userId = currentUser.email || currentUser.id;

        // Run migration if needed
        await chatHistoryService.migrateLocalSessionsToDb(userId);
        // migrateOldChatToSessions(currentUser.id); // OLD MIGRATION, replaced by DB migration

        // Load sessions
        const sessions = await chatHistoryService.getChatSessions(userId);
        setChatSessions(sessions);


        // Always start with a new chat (clean slate) - BUT DO NOT CREATE SESSION YET
        // handleNewChat(); 
        // Instead, just clear state and let handleNewChat do the rest (which now sets null)
        setCurrentSessionId(null);
        setMessages([]);

        // Load session cost from localStorage
        const savedCost = localStorage.getItem(`legalrnd_session_cost_${currentUser.id}`);
        if (savedCost) {
          setSessionCost(parseFloat(savedCost));
        } else {
          setSessionCost(0);
        }
      } else {
        // No user = clear everything
        setMessages([]);
        setSelectedDocumentIds([]);

        setSessionCost(0);
        setCurrentSessionId(null);
        setChatSessions([]);
      }
    };
    initSessions();
  }, [currentUser?.id]);

  const loadUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      // Try to get user from sessionStorage (selected on AuthPage)
      const storedUser = sessionStorage.getItem('selectedUser');

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setCurrentUser(parsedUser as any);
          return;
        } catch (e) {
          console.error('Failed to parse stored user:', e);
        }
      }

      // Fallback to default user if no session data
      const defaultUser = {
        id: 'lawyer1@legalrnd.com',
        email: 'lawyer1@legalrnd.com',
        user_metadata: {
          name: 'Adv. Rajesh Kumar',
          role: 'Lawyer'
        }
      };

      console.log('⚠️ No user selected, using default:', defaultUser.user_metadata.name);
      setCurrentUser(defaultUser as any);
      return;
    }

    console.log('✅ loadUser: User authenticated:', { id: user.id, email: user.email });
    setCurrentUser(user);
    if (user) {
      loadSavedChats(user.email || user.id);
    }
  };

  /**
   * ========================================
   * SESSION MANAGEMENT FUNCTIONS
   * ========================================
   */

  const loadSession = async (sessionId: string) => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      const messages = await chatHistoryService.loadSessionMessages(currentUser.id, sessionId);
      setMessages(messages);
      setCurrentSessionId(sessionId);

      // Update active status
      chatHistoryService.setActiveSession(currentUser.id, sessionId);

      // Update list to reflect active status visually (though we handle it via currentSessionId prop mostly)
      const sessions = await chatHistoryService.getChatSessions(currentUser.id);
      setChatSessions(sessions);
    } catch (error) {
      console.error("Failed to load session", error);
      toast.error("Failed to load chat session");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = async () => {
    // OLD: Create session immediately
    // if (!currentUser) return;
    // const newSession = chatHistoryService.createChatSession(currentUser.id);
    // setCurrentSessionId(newSession.id);
    // setMessages([]);
    // setChatSessions([newSession, ...chatSessions]);

    // NEW: Just clear the UI. Session created on first message.
    setCurrentSessionId(null);
    setMessages([]);
    setSessionCost(0);
    // Don't touch chatSessions yet (sidebar remains as is until new session created)

    // Optional: Refresh sessions list just in case
    if (currentUser) {
      const sessions = await chatHistoryService.getChatSessions(currentUser.id);
      setChatSessions(sessions);
    }
  };

  const handleSessionDelete = async (sessionId: string) => {
    if (!currentUser) return;

    if (!window.confirm("Are you sure you want to delete this chat?")) return;

    const userId = currentUser.email || currentUser.id;
    await chatHistoryService.deleteSession(userId, sessionId);
    const sessions = await chatHistoryService.getChatSessions(userId);
    setChatSessions(sessions);

    // If deleted current session, load another or create new
    if (sessionId === currentSessionId) {
      if (sessions.length > 0) {
        await loadSession(sessions[0].id);
      } else {
        handleNewChat();
      }
    }
  };

  const loadSavedChats = async (userId: string) => {
    const result = await chatHistoryService.loadChats(userId, { limit: 10 });
    if (result.success && result.chats) {
      setSavedChats(result.chats);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Check if user is logged in
    if (!currentUser) {
      toast.error('Please wait for authentication to complete or log in again');
      return;
    }

    // Check if documents are selected (if not, show toast)
    // if (selectedDocumentIds.length === 0) {
    //   toast.error('Please select at least one document first');
    //   return;
    // }

    const questionText = text.trim();
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: questionText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInputValue('');

    // Scroll to bottom for user message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    // --- LAZY SESSION CREATION ---
    let activeSessionId = currentSessionId;
    if (!activeSessionId && currentUser) {
      console.log('Creates new session on first message...');
      const userId = currentUser.email || currentUser.id;
      const newSession = await chatHistoryService.createChatSession(userId);
      activeSessionId = newSession.id;
      setCurrentSessionId(newSession.id);

      // Update sidebar immediately
      setChatSessions(prev => [newSession, ...prev]);
    }
    // -----------------------------

    try {
      const response = await ragService.askQuestion(questionText, {
        lawyerId: currentUser?.email,  // ✅ FIXED: Pass email for RLS policy (not ID)
        // selectedDocumentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
        // selectedMasters: selectedMasters.length > 0 ? selectedMasters : undefined,
        sessionId: activeSessionId || undefined // Pass session ID if available (optional for analytics)
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.success ? response.answer || '' : response.message || 'No response',
        summary: response.summary,
        reading_time: response.reading_time,
        timestamp: new Date(),
        citations: response.citations,
        aiModel: response.metadata?.model,
        debug: response.debug,
        // Capture new fields for LLM Response display
        rawResponse: response.rawResponse,
        tokenUsage: response.tokenUsage,
        estimatedCost: response.estimatedCost
      };

      // Update session cost
      if (response.estimatedCost) {
        setSessionCost(prev => prev + response.estimatedCost!);
      }

      setMessages(prev => [...prev, assistantMessage]);

      // Smart Scroll: Scroll to the QUESTION so user sees context + answer
      setTimeout(() => {
        const questionElement = document.getElementById(`message-${userMessage.id}`);
        if (questionElement) {
          questionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          // Fallback to answer if question not found (rare)
          const answerElement = document.getElementById(`message-${assistantMessage.id}`);
          answerElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      await handleSendMessage(inputValue);
    }
  };

  const handleSaveChat = async () => {
    if (!currentUser) {
      toast.error('Please log in to save chats');
      return;
    }

    if (messages.length === 0) {
      toast.error('No messages to save');
      return;
    }

    const title = chatTitle || `Chat ${new Date().toLocaleDateString()}`;
    const result = await chatHistoryService.saveChat({
      title,
      lawyerId: currentUser.id,
      messages,
      selectedDocumentIds
    });

    if (result.success) {
      toast.success('Chat saved successfully!');
      setShowSaveDialog(false);
      setChatTitle('');
      loadSavedChats(currentUser.id);
    } else {
      toast.error('Failed to save chat');
    }
  };

  const handleLoadChat = async (chatId: string) => {
    const result = await chatHistoryService.loadChat(chatId);
    if (result.success && result.chat) {
      setMessages(result.chat.messages);
      setSelectedDocumentIds(result.chat.selected_document_ids || []);
      setShowHistoryPanel(false);
      toast.success('Chat loaded');
    } else {
      toast.error('Failed to load chat');
    }
  };

  const handleExportToPDF = async () => {
    if (!chatContainerRef.current) return;

    try {
      toast.info('Generating PDF...');
      const canvas = await html2canvas(chatContainerRef.current, {
        scale: 2,
        logging: false,
        windowWidth: 800
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`heartfulness-chat-${Date.now()}.pdf`);
      toast.success('PDF downloaded!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    }
  };

  const handleCopyMessage = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      setTimeout(() => setCopiedMessageId(null), 2000);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Clear all messages? This cannot be undone.')) {
      setMessages([]);
      setSessionCost(0);
      if (currentUser) {
        chatHistoryService.clearLocalStorage(`current_${currentUser.id}`);
        localStorage.removeItem(`legalrnd_session_cost_${currentUser.id}`);
      }
      toast.success('Chat cleared');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
      navigate('/auth');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    }
  };

  const handleSelectionChange = (docIds: string[]) => {
    setSelectedDocumentIds(docIds);
  };

  return (
    <div className="h-screen flex flex-col bg-dark-bg-primary overflow-hidden">
      {/* Header */}
      <header className="bg-dark-bg-secondary border-b border-dark-border-primary shadow-sm">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-dark-text-primary flex items-center gap-2">
                ⚖️ Legal Research Assistant
              </h1>
              <p className="text-xs text-dark-text-secondary">
                Searching legal documents and case law
              </p>
            </div>
          </div>

          {/* Session Cost Display */}
          {sessionCost > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-dark-bg-elevated rounded-lg border border-dark-border-primary">
              <span className="text-xs text-dark-text-secondary">Session Cost:</span>
              <span className="text-xs font-mono font-bold text-dark-accent-orange">
                ${sessionCost.toFixed(6)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistoryPanel(!showHistoryPanel)}
              className="p-2 hover:bg-dark-bg-elevated rounded-lg transition"
              title="Chat History"
            >
              <History className="h-5 w-5 text-dark-accent-orange" />
            </button>
            <button
              onClick={() => setShowSaveDialog(true)}
              className="p-2 hover:bg-dark-bg-elevated rounded-lg transition"
              disabled={messages.length === 0}
              title="Save Chat"
            >
              <Save className="h-5 w-5 text-dark-accent-orange" />
            </button>
            <button
              onClick={handleExportToPDF}
              className="p-2 hover:bg-dark-bg-elevated rounded-lg transition"
              disabled={messages.length === 0}
              title="Export to PDF"
            >
              <Download className="h-5 w-5 text-dark-accent-orange" />
            </button>
            <button
              onClick={handleClearChat}
              className="p-2 hover:bg-red-900/30 rounded-lg transition"
              disabled={messages.length === 0}
              title="Clear Chat"
            >
              <Trash2 className="h-5 w-5 text-red-400" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-dark-bg-elevated rounded-lg transition"
              title="Logout"
            >
              <LogOut className="h-5 w-5 text-dark-text-secondary" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-x-auto overflow-y-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Sidebar - Document Tree Selector (REMOVED) */}
        <div className="w-72 sm:w-80 flex-shrink-0 bg-dark-bg-secondary border-r border-dark-border-primary shadow-lg hidden md:flex md:flex-col">
          {/* Document Tree Selector */}
          <div className="flex-shrink-0 border-b border-dark-border-primary">
            <DocumentTreeSelector
              onSelectionChange={handleSelectionChange}
              className="h-auto"
            />
          </div>

          {/* Chat History Sidebar */}
          {currentUser && (
            <div className="flex-1 overflow-hidden">
              <ChatHistorySidebar
                userId={currentUser.email || currentUser.id}
                sessions={chatSessions}
                currentSessionId={currentSessionId}
                onSessionSelect={loadSession}
                onNewChat={handleNewChat}
                onSessionDelete={handleSessionDelete}
              />
            </div>
          )}
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6"
          >
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-2xl px-4">
                  <BookOpen className="h-16 w-16 mx-auto mb-4 text-dark-accent-orange/60" />
                  <h2 className="text-2xl font-semibold text-dark-text-primary mb-2">
                    Welcome to Legal Research Assistant
                  </h2>
                  <p className="text-dark-text-secondary mb-8">
                    Ask questions about Indian law, case law, statutes, and judicial precedents.
                  </p>

                  {/* Sample Prompts */}
                  <div className="grid grid-cols-2 gap-2 md:gap-4 text-left">
                    {[
                      "What is the basic structure doctrine?",
                      "Explain the right to privacy under Article 21",
                      "What is the test for judicial review?",
                      "Explain the doctrine of legitimate expectation"
                    ].map((question, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(question)}
                        className="p-2 md:p-4 bg-dark-bg-elevated hover:bg-dark-bg-elevated/80 border border-dark-border-primary hover:border-dark-accent-orange/50 rounded-xl transition text-xs md:text-sm text-dark-text-primary font-medium text-center"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                id={`message-${message.id}`}
                className={`flex max-w-4xl mx-auto w-full ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`rounded-lg ${message.type === 'user'
                    ? 'max-w-[85%] md:max-w-[75%] question-bubble shadow-sm'
                    : 'w-full bg-transparent p-0'
                    }`}
                >
                  <div className={message.type === 'user' ? 'p-4' : 'py-2'}>
                    {message.type === 'user' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        className="prose prose-sm max-w-none prose-invert"
                      >
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <StructuredMessage
                        message={message}
                        onCopy={() => handleCopyMessage(message)}
                      />
                    )}
                  </div>

                  {/* Message Actions */}
                  <div className={`px-4 pb-2 flex items-center gap-2 ${message.type === 'user' ? 'border-t border-dark-border-primary' : 'mt-2 pt-2 border-t border-dark-border-primary'}`}>
                    <button
                      onClick={() => handleCopyMessage(message)}
                      className={`text-xs p-1.5 rounded transition flex items-center gap-1 ${message.type === 'user' ? 'text-dark-text-secondary hover:bg-dark-bg-secondary' : 'text-dark-text-secondary hover:bg-dark-bg-elevated'
                        }`}
                    >
                      {copiedMessageId === message.id ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                    {message.aiModel && (
                      <span className="text-xs text-dark-text-muted ml-auto">
                        {message.aiModel}
                      </span>
                    )}
                    {message.debug && (
                      <button
                        onClick={() => {
                          setDebugData(message.debug || null);
                          setShowDebugModal(true);
                        }}
                        className={`text-xs p-1.5 rounded transition flex items-center gap-1 ml-2 ${message.type === 'user' ? 'text-dark-text-secondary hover:bg-dark-bg-secondary' : 'text-dark-text-secondary hover:bg-dark-bg-elevated'
                          }`}
                        title="View System Prompt"
                      >
                        <Code className="h-3 w-3" />
                        Prompt
                      </button>
                    )}
                    {/* New LLM Response button */}
                    {message.rawResponse && message.tokenUsage && (
                      <button
                        onClick={() => {
                          setLLMResponseData({
                            rawResponse: message.rawResponse!,
                            tokenUsage: message.tokenUsage!,
                            estimatedCost: message.estimatedCost || 0,
                            aiModel: message.aiModel
                          });
                          setShowLLMResponseModal(true);
                        }}
                        className={`text-xs p-1.5 rounded transition flex items-center gap-1 ml-2 ${message.type === 'user' ? 'text-dark-text-secondary hover:bg-dark-bg-secondary' : 'text-dark-text-secondary hover:bg-dark-bg-elevated'
                          }`}
                        title="View LLM Response Details"
                      >
                        <FileText className="h-3 w-3" />
                        LLM Response ({(message.tokenUsage.grandTotal / 1000).toFixed(1)}K)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex max-w-4xl mx-auto w-full justify-start">
                <div className="bg-dark-bg-elevated border border-dark-border-primary rounded-lg shadow-sm p-4 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-dark-accent-orange" />
                  <span className="text-dark-text-secondary">Searching Legal documents...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="border-t border-dark-border-primary bg-dark-bg-secondary p-2 md:p-4">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask your legal query..."
                  className="flex-1 px-3 py-2 md:px-4 md:py-3 rounded-lg bg-dark-bg-primary border border-dark-border-primary focus:outline-none focus:border-dark-accent-orange text-dark-text-primary placeholder-dark-text-muted text-sm md:text-base"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  disabled={isLoading}
                  className={`px-3 py-2 md:px-4 md:py-3 rounded-lg font-medium transition text-sm md:text-base flex items-center gap-2 ${isListening
                    ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                    : 'bg-dark-bg-elevated hover:bg-dark-bg-tertiary text-dark-text-primary border border-dark-border-primary'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={isListening ? 'Stop listening' : 'Voice input'}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="px-3 py-2 md:px-6 md:py-3 bg-dark-accent-orange text-white rounded-lg hover:bg-dark-accent-orangeHover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition text-sm md:text-base whitespace-nowrap"
                >
                  <Send className="h-4 w-4" />
                  {isLoading ? 'Thinking...' : 'Ask'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* History Panel */}
        {showHistoryPanel && (
          <div className="w-80 bg-dark-bg-secondary border-l border-dark-border-primary shadow-lg overflow-y-auto">
            <div className="p-4 border-b border-dark-border-primary">
              <h3 className="font-semibold text-dark-text-primary flex items-center gap-2">
                <History className="h-5 w-5" />
                Saved Chats
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {savedChats.length === 0 ? (
                <p className="text-sm text-dark-text-secondary text-center py-8">No saved chats yet</p>
              ) : (
                savedChats.map(chat => (
                  <div
                    key={chat.id}
                    onClick={() => handleLoadChat(chat.id)}
                    className="p-3 border border-dark-border-primary rounded-lg hover:bg-dark-bg-elevated cursor-pointer transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-dark-text-primary truncate">
                          {chat.chat_title}
                        </p>
                        <p className="text-xs text-dark-text-muted">
                          {new Date(chat.saved_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-dark-accent-orange mt-1">
                          {chat.messages.length} messages
                        </p>
                      </div>
                      {chat.is_pinned && <Pin className="h-4 w-4 text-dark-accent-orange" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-dark-bg-secondary rounded-lg shadow-xl max-w-md w-full mx-4 border border-dark-border-primary">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-dark-text-primary mb-4">Save Chat</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-text-secondary mb-2">
                  Chat Title (optional)
                </label>
                <input
                  type="text"
                  value={chatTitle}
                  onChange={(e) => setChatTitle(e.target.value)}
                  placeholder={`Chat ${new Date().toLocaleDateString()}`}
                  className="w-full px-3 py-2 bg-dark-bg-primary border border-dark-border-primary rounded-lg focus:outline-none focus:border-dark-accent-orange text-dark-text-primary placeholder-dark-text-muted"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1 px-4 py-2 bg-dark-bg-elevated text-dark-text-primary rounded-lg hover:bg-dark-bg-primary transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveChat}
                  className="flex-1 px-4 py-2 bg-dark-accent-orange text-white rounded-lg hover:bg-dark-accent-orangeHover transition flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDebugModal && debugData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-bg-secondary rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-dark-border-primary">
            <div className="p-4 border-b border-dark-border-primary flex justify-between items-center bg-dark-bg-elevated rounded-t-lg">
              <h3 className="text-lg font-semibold text-dark-text-primary flex items-center gap-2">
                <Code className="h-5 w-5 text-dark-accent-orange" />
                Prompt Debugger
              </h3>
              <button
                onClick={() => setShowDebugModal(false)}
                className="text-dark-text-secondary hover:text-dark-text-primary"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs md:text-sm">
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-dark-text-primary mb-2 border-b border-dark-border-primary pb-1">System Prompt (Context & Instructions)</h4>
                  <pre className="bg-dark-bg-primary p-4 rounded-lg whitespace-pre-wrap text-dark-text-secondary">
                    {debugData.systemPrompt}
                  </pre>
                </div>
                <div>
                  <h4 className="font-bold text-dark-text-primary mb-2 border-b border-dark-border-primary pb-1">User Prompt (Question)</h4>
                  <pre className="bg-dark-bg-primary p-4 rounded-lg whitespace-pre-wrap text-dark-text-secondary">
                    {debugData.userPrompt}
                  </pre>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-dark-border-primary flex justify-end">
              <button
                onClick={() => setShowDebugModal(false)}
                className="px-4 py-2 bg-dark-accent-orange text-white rounded-lg hover:bg-dark-accent-orangeHover transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New LLM Response Details Modal */}
      {showLLMResponseModal && llmResponseData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-bg-secondary rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-dark-border-primary">
            <div className="p-4 border-b border-dark-border-primary flex justify-between items-center bg-dark-bg-elevated rounded-t-lg">
              <h3 className="text-lg font-semibold text-dark-text-primary flex items-center gap-2">
                <FileText className="h-5 w-5 text-dark-accent-orange" />
                LLM Response Details
              </h3>
              <button
                onClick={() => setShowLLMResponseModal(false)}
                className="text-dark-text-secondary hover:text-dark-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs md:text-sm">
              <div className="space-y-6">
                {/* Token Usage & Cost Summary Card */}
                <div className="bg-dark-bg-elevated p-4 rounded-lg border border-dark-border-primary">
                  <h4 className="font-bold text-dark-text-primary mb-3">Token Usage & Cost</h4>
                  <div className="space-y-3">
                    {/* AI Model - Full width */}
                    {llmResponseData.aiModel && (
                      <div className="pb-3 border-b border-dark-border-primary">
                        <span className="text-dark-text-secondary text-sm">AI Model:</span>
                        <span className="ml-2 text-dark-text-primary font-mono text-sm font-semibold">
                          {llmResponseData.aiModel}
                        </span>
                      </div>
                    )}
                    {/* Token counts grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-dark-text-secondary">Embedding Tokens:</span>
                        <span className="ml-2 text-dark-text-primary font-mono">{llmResponseData.tokenUsage.embeddingTokens.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-dark-text-secondary">LLM Prompt Tokens:</span>
                        <span className="ml-2 text-dark-text-primary font-mono">{llmResponseData.tokenUsage.promptTokens.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-dark-text-secondary">LLM Completion Tokens:</span>
                        <span className="ml-2 text-dark-text-primary font-mono">{llmResponseData.tokenUsage.completionTokens.toLocaleString()}</span>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-dark-border-primary">
                        <span className="text-dark-text-secondary font-semibold">Grand Total (All Tokens):</span>
                        <span className="ml-2 text-dark-text-primary font-mono font-bold text-base">{llmResponseData.tokenUsage.grandTotal.toLocaleString()}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-dark-text-secondary font-semibold">Estimated Cost:</span>
                        <span className="ml-2 text-dark-accent-orange font-mono font-bold text-base">
                          ${llmResponseData.estimatedCost.toFixed(6)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Raw LLM Response */}
                <div>
                  <h4 className="font-bold text-dark-text-primary mb-2 border-b border-dark-border-primary pb-1">
                    Raw LLM Response
                  </h4>
                  <pre className="bg-dark-bg-primary p-4 rounded-lg whitespace-pre-wrap text-dark-text-secondary max-h-96 overflow-y-auto">
                    {llmResponseData.rawResponse}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-dark-border-primary flex justify-end">
              <button
                onClick={() => setShowLLMResponseModal(false)}
                className="px-4 py-2 bg-dark-accent-orange text-white rounded-lg hover:bg-dark-accent-orangeHover transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Component to handle the 3-section structured response with modern tabbed interface
 */
function StructuredMessage({ message, onCopy }: { message: ChatMessage, onCopy: () => void }) {
  // Track which sections are expanded (Summary open by default)
  const [expandedSections, setExpandedSections] = useState<Set<'summary' | 'detail' | 'citations'>>(
    () => new Set(message.summary ? ['summary'] : ['detail'])
  );

  const toggleSection = (section: 'summary' | 'detail' | 'citations') => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };



  return (
    <div className="space-y-3">

      {/* Summary Section */}
      {message.summary && (
        <AccordionSection
          title="Summary"
          icon={AlignLeft}
          badge={message.reading_time?.summary}
          isExpanded={expandedSections.has('summary')}
          onToggle={() => toggleSection('summary')}
          onCopy={onCopy}
        >
          <div className="text-dark-text-primary text-sm leading-relaxed">
            {message.summary}
          </div>
        </AccordionSection>
      )}

      {/* Detail Section */}
      <AccordionSection
        title="Detailed Answer"
        icon={FileText}
        badge={message.reading_time?.detail}
        isExpanded={expandedSections.has('detail')}
        onToggle={() => toggleSection('detail')}
        onCopy={onCopy}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          className="prose prose-sm max-w-none prose-invert"
        >
          {message.content}
        </ReactMarkdown>

        {/* Embedded Videos in Detail View */}
        {message.citations && message.citations.some(c => c.youtube_video_id) && (
          <div className="mt-6 pt-4 border-dark-border-primary space-y-3">
            <p className="text-sm font-medium text-dark-accent-orange flex items-center gap-2">
              <span>📹</span>
              Video Sources
            </p>
            <div className="grid grid-cols-1 gap-4">
              {message.citations
                .filter(c => c.youtube_video_id)
                .slice(0, 2)
                .map((citation, idx) => (
                  <YouTubePlayer
                    key={idx}
                    videoId={citation.youtube_video_id!}
                    startTime={citation.start_timestamp || 0}
                    title={`${citation.document_title} - ${citation.master_name}`}
                    className="w-full"
                  />
                ))}
            </div>
          </div>
        )}
      </AccordionSection>

      {/* Sources Section */}
      {message.citations && message.citations.length > 0 && (
        <AccordionSection
          title="Sources"
          icon={BookOpen}
          badge={`${message.citations.length}`}
          isExpanded={expandedSections.has('citations')}
          onToggle={() => toggleSection('citations')}
        >
          <SourceCitation citations={message.citations} />
        </AccordionSection>
      )}
    </div>
  );
}
