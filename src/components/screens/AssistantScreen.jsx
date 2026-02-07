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
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 relative font-sans">
      {/* Header Section - Glassmorphism */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-white/80 border-b border-gray-200/50 px-4 py-3 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] transition-all">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent tracking-tight">
              Assistant
            </h2>
            <button
              type="button"
              onClick={onNewThread}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50/80 text-blue-600 hover:bg-blue-100 hover:shadow-sm transition-all flex items-center gap-1 active:scale-95"
            >
              <span className="text-lg leading-none">+</span>
              <span>New Chat</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Mode Toggle */}
            <div className="bg-gray-100/80 p-1 rounded-xl flex items-center shadow-inner">
              <button
                type="button"
                onClick={() => setMode('union')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${mode === 'union'
                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-black/5'
                  }`}
              >
                Union Steward
              </button>
              <button
                type="button"
                onClick={() => setMode('app')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${mode === 'app'
                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-black/5'
                  }`}
              >
                App Help
              </button>
            </div>

            {/* Thread Selector */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <select
                  className="appearance-none w-full bg-white/50 hover:bg-white border border-gray-200 rounded-xl px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer"
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
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 px-1 font-medium">
            {mode === 'union'
              ? 'Answers are grounded in loaded manuals (e.g., M-41).'
              : 'Ask specifically about app features and navigation.'}
          </p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-6 pb-4">
          {error && (
            <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-700 rounded-xl p-4 text-sm flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
              <span className="mt-0.5 text-lg">⚠️</span>
              <p className="leading-snug">{error}</p>
            </div>
          )}

          {(messages || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-500 animate-in zoom-in-95 duration-500">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-full mb-4 shadow-sm ring-1 ring-blue-100">
                <span className="text-3xl">👋</span>
              </div>
              <p className="font-semibold text-gray-900 text-lg">Hello!</p>
              <p className="text-sm mt-1 text-gray-500">
                {mode === 'union' ? 'I can help with union contract questions.' : 'I can help you navigate the app.'}
              </p>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-md backdrop-blur-sm
                      ${m.role === 'user'
                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-sm ring-1 ring-blue-700/50'
                        : 'bg-white/95 text-gray-800 border border-gray-100 rounded-tl-sm ring-1 ring-black/5'}`}
                  >
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>

                    {/* Citations */}
                    {m.citations && Array.isArray(m.citations) && m.citations.length > 0 && (
                      <div className={`mt-3 pt-3 border-t text-xs ${m.role === 'user' ? 'border-white/20' : 'border-gray-100'}`}>
                        <div className="font-semibold mb-1 opacity-90 flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
                          Sources:
                        </div>
                        <ul className="list-disc pl-4 space-y-0.5 opacity-80">
                          {m.citations.map((c, idx) => (
                            <li key={idx}>
                              {c.source || 'Source'}{c.section ? ` — ${c.section}` : ''}{c.page ? ` (p. ${c.page})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className={`text-[10px] mt-1.5 text-right opacity-70 font-medium`}>
                      {m.created_at ? formatTime(m.created_at) : ''}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start animate-in fade-in duration-300">
                  <div className="bg-white/90 border border-gray-100 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-blue-500/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-blue-500/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} className="h-2" />
            </>
          )}
        </div>
      </div>

      {/* Input Area - Fixed/Modern */}
      <div className="bg-white/80 backdrop-blur-xl border-t border-gray-200/50 p-4 sticky bottom-0 z-30 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.03)]">
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
              className="w-full bg-gray-50/50 hover:bg-white focus:bg-white border border-gray-200 focus:border-blue-500/50 text-gray-900 text-base rounded-2xl px-4 py-3 focus:ring-4 focus:ring-blue-500/10 outline-none resize-none min-h-[50px] max-h-[160px] shadow-inner transition-all placeholder:text-gray-400"
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
              className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full p-3 hover:shadow-lg hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all shadow-md active:scale-95 flex-shrink-0 mb-1 ring-1 ring-blue-700/20"
              aria-label="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </form>
          <div className="text-center mt-2 pb-[env(safe-area-inset-bottom)]">
            <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase opacity-70">
              AI can make mistakes. Please verify.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
