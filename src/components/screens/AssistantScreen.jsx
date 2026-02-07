import { useEffect, useMemo, useRef, useState } from 'react';
import { sendAssistantMessage, listAssistantThreads, getAssistantThreadMessages, createAssistantThread } from '../../services/assistantService';

function formatTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function AssistantScreen() {
  const [mode, setMode] = useState('union'); // 'union' | 'app'
  const [threads, setThreads] = useState([]);
  const [threadId, setThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const modeLabel = useMemo(() => (mode === 'union' ? 'Union Steward (NALC)' : 'App Help'), [mode]);

  useEffect(() => {
    (async () => {
      try {
        const t = await listAssistantThreads();
        setThreads(t);
        if (!threadId && t?.[0]?.id) setThreadId(t[0].id);
      } catch (e) {
        setError(String(e?.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      if (!threadId) return;
      try {
        const m = await getAssistantThreadMessages(threadId);
        setMessages(m);
      } catch (e) {
        setError(String(e?.message || e));
      }
    })();
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function autosizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;

    // Reset then grow to fit content.
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 160);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > 160 ? 'auto' : 'hidden';
  }

  useEffect(() => {
    // Keep textarea height in sync when we programmatically clear/set input.
    autosizeTextarea();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  async function onNewThread() {
    setError(null);
    try {
      const t = await createAssistantThread({ title: mode === 'union' ? 'Union question' : 'App question' });
      setThreads((prev) => [t, ...(prev || [])]);
      setThreadId(t.id);
      setMessages([]);
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  async function onSend(e) {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    setLoading(true);

    // Optimistic user message
    const optimistic = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...(prev || []), optimistic]);
    setInput('');

    try {
      const res = await sendAssistantMessage({ threadId, mode, message: text });
      if (!threadId && res.threadId) setThreadId(res.threadId);

      // Refresh messages from DB to keep canonical order/ids.
      if (res.threadId) {
        const m = await getAssistantThreadMessages(res.threadId);
        setMessages(m);
      }

      // Refresh threads list (so new thread shows up)
      const t = await listAssistantThreads();
      setThreads(t);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 tracking-tight">Assistant</h2>
            <button
              type="button"
              onClick={onNewThread}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-1"
            >
              <span>+ New Chat</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Mode Toggle */}
            <div className="bg-gray-100 p-1 rounded-lg flex items-center">
              <button
                type="button"
                onClick={() => setMode('union')}
                 className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  mode === 'union' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Union Steward
              </button>
              <button
                type="button"
                onClick={() => setMode('app')}
                 className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  mode === 'app' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                App Help
              </button>
            </div>

            {/* Thread Selector */}
            <div className="flex-1 min-w-[200px]">
              <select
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={threadId || ''}
                onChange={(e) => setThreadId(e.target.value || null)}
              >
                <option value="">Select a previous conversation...</option>
                {(threads || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title || 'Untitled Conversation'}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <p className="text-xs text-gray-500 px-1">
            {mode === 'union' 
              ? 'Answers are grounded in loaded manuals (e.g., M-41).' 
              : 'Ask specifically about app features and navigation.'}
          </p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-6 pb-24">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          {(messages || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-500">
              <div className="bg-gray-100 p-4 rounded-full mb-3">
                <span className="text-2xl">👋</span>
              </div>
              <p className="font-medium text-gray-900">Hello!</p>
              <p className="text-sm mt-1">
                {mode === 'union' ? 'I can help with union contract questions.' : 'I can help you navigate the app.'}
              </p>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm 
                      ${m.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-sm' 
                        : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'}`}
                  >
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>
                    
                    {/* Citations */}
                    {m.citations && Array.isArray(m.citations) && m.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-black/10 text-xs">
                        <div className="font-semibold mb-1 opacity-90">Sources:</div>
                        <ul className="list-disc pl-4 space-y-0.5 opacity-80">
                          {m.citations.map((c, idx) => (
                            <li key={idx}>
                              {c.source || 'Source'}{c.section ? ` — ${c.section}` : ''}{c.page ? ` (p. ${c.page})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className={`text-[10px] mt-1.5 text-right opacity-70`}>
                      {m.created_at ? formatTime(m.created_at) : ''}
                    </div>
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-2">
                     <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                     <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                     <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4 sticky bottom-0 w-full">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={onSend} className="relative flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                requestAnimationFrame(() => autosizeTextarea());
              }}
              rows={1}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-base rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none min-h-[50px] max-h-[160px]"
              placeholder={mode === 'union' ? 'Ask a contract question...' : 'How do I add a stop?'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-blue-600 text-white rounded-full p-3 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex-shrink-0 mb-1"
              aria-label="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </form>
          <div className="text-center mt-2 pb-[env(safe-area-inset-bottom)]">
            <p className="text-[10px] text-gray-400">
              AI can make mistakes. Please verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
