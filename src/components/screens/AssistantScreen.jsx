import { useEffect, useMemo, useRef, useState } from 'react';
import { sendAssistantMessage, listAssistantThreads, getAssistantThreadMessages, createAssistantThread } from '../../services/assistantService';

function formatTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString();
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
    <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">Assistant</h2>
              <p className="text-sm text-gray-600 truncate">Mode: <span className="font-semibold">{modeLabel}</span></p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('app')}
                className={`px-3 py-1 rounded-md text-sm border ${mode === 'app' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                App Help
              </button>
              <button
                type="button"
                onClick={() => setMode('union')}
                className={`px-3 py-1 rounded-md text-sm border ${mode === 'union' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                Union Steward
              </button>
              <button
                type="button"
                onClick={onNewThread}
                className="px-3 py-1 rounded-md text-sm border border-gray-300 bg-white text-gray-700"
              >
                New
              </button>
            </div>
          </div>

          <div className="mt-3">
            <label className="text-xs text-gray-500">Thread</label>
            <select
              className="w-full mt-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={threadId || ''}
              onChange={(e) => setThreadId(e.target.value || null)}
            >
              <option value="">(No thread selected)</option>
              {(threads || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title || 'Untitled'}
                </option>
              ))}
            </select>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Union answers are grounded in the manuals we’ve loaded (M-41 first). If the sources don’t support something, the assistant will say so.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow p-4 mb-4 min-h-[45vh]">
          {(messages || []).length === 0 ? (
            <div className="text-sm text-gray-600">
              Ask a question to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'} rounded-lg px-3 py-2 max-w-[85%]`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                    <div className={`text-[10px] mt-1 ${m.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                      {m.created_at ? formatTime(m.created_at) : ''}
                    </div>
                    {m.citations && Array.isArray(m.citations) && m.citations.length > 0 && (
                      <div className="mt-2 text-[11px]">
                        <div className="font-semibold">Sources</div>
                        <ul className="list-disc pl-4">
                          {m.citations.map((c, idx) => (
                            <li key={idx} className="opacity-90">
                              {c.source || 'Source'}{c.section ? ` — ${c.section}` : ''}{c.page ? ` (p. ${c.page})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="text-sm text-gray-500">Assistant is thinking…</div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <form onSubmit={onSend} className="bg-white rounded-xl shadow p-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder={mode === 'union' ? 'Ask a union/contract question…' : 'Ask how to do something in RouteWise…'}
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
