import { supabase } from '../lib/supabase';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured');
}

export async function listAssistantThreads() {
  requireSupabase();
  const { data, error } = await supabase
    .from('assistant_threads')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

export async function createAssistantThread({ title } = {}) {
  requireSupabase();
  const { data, error } = await supabase
    .from('assistant_threads')
    .insert({ title: title || 'New thread' })
    .select('id, title, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

export async function getAssistantThreadMessages(threadId) {
  requireSupabase();
  const { data, error } = await supabase
    .from('assistant_messages')
    .select('id, role, content, citations, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) throw error;
  return data || [];
}

export async function sendAssistantMessage({ threadId, mode, message }) {
  requireSupabase();
  const payload = { threadId: threadId || null, mode, message };

  const { data, error } = await supabase.functions.invoke('assistant-chat', {
    body: payload,
  });

  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'Assistant error');
  return data;
}
