// Supabase Edge Function: assistant-chat
//
// Purpose:
// - Persist chat threads/messages for the signed-in user.
// - (Union mode) Retrieve relevant NALC manual snippets (starting with M-41) from nalc_chunks.
// - Generate a response (model integration can be enabled later via secrets).
//
// Secrets required:
// - SUPABASE_URL
// - SUPABASE_ANON_KEY
// - SUPABASE_SERVICE_ROLE_KEY (used for doc retrieval)
// Optional (for real AI answers):
// - OPENAI_API_KEY

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

type Mode = 'union' | 'app'

// RouteWise carrier manual (condensed, AI-friendly).
// Keep this short: it’s used as a reference to produce consistent, carrier-language help.
const ROUTEWISE_CARRIER_MANUAL = `
ROUTEWISE CARRIER QUICK MANUAL (reference)

Core timers:
- 722 = AM Office (before leaving)
- 721 = Street Time (delivering)
- 744 = PM Office (after returning)

Key daily workflow:
1) Today: enter volumes (DPS pieces, Flats ft, Letters ft, Packages total → Parcels+SPRs)
2) Tap Start Route (721) when you leave office; app captures leave time + 722 minutes.
3) Start 744 when you return.
4) End Tour to save the day (this is what improves future predictions).

Confidence:
- Predictions improve over 2–3 weeks as history builds.
- Exclude “bad data” days from averages so they don’t poison predictions.

Troubleshooting:
- If volumes disappear mid-day, re-enter them; newer versions autosave volumes.
- If timers disappear, refresh and ensure you’re logged in; timers restore from saved state.
`

type Citation = {
  source?: string
  section?: string
  page?: number
  url?: string
}

type RelevantItem = {
  title: string
  article?: string
  doc_type?: string
  url: string
  notes?: string
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function getEnv(name: string) {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`missing ${name} secret`)
  return v
}

function getUserClient(req: Request) {
  const url = getEnv('SUPABASE_URL')
  const anon = getEnv('SUPABASE_ANON_KEY')
  const authHeader = req.headers.get('Authorization') || ''

  return createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  })
}

function getAdminClient() {
  const url = getEnv('SUPABASE_URL')
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function pickSearchTerm(message: string) {
  const words = (message || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length >= 5)
    .slice(0, 20)

  // Prefer longer words first
  words.sort((a, b) => b.length - a.length)
  return words[0] || null
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') return json(405, { ok: false, error: 'Use POST' })

    const supabase = getUserClient(req)
    const admin = getAdminClient()

    // Auth
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr) return json(401, { ok: false, error: 'Unauthorized' })
    const user = userData?.user
    if (!user) return json(401, { ok: false, error: 'Unauthorized' })

    let payload: any = null
    try {
      payload = await req.json()
    } catch {
      payload = {}
    }

    const mode: Mode = (String(payload?.mode || 'union') as any) === 'app' ? 'app' : 'union'
    const message = String(payload?.message || '').trim()
    const threadIdIn = payload?.threadId ? String(payload.threadId) : null

    if (!message) return json(400, { ok: false, error: 'Body must include { message }' })

    // Create thread if missing
    let threadId = threadIdIn
    if (!threadId) {
      const title = message.length > 60 ? `${message.slice(0, 57)}…` : message
      const { data: thread, error: tErr } = await supabase
        .from('assistant_threads')
        .insert({ title })
        .select('id')
        .single()

      if (tErr) throw tErr
      threadId = thread?.id
    }

    // Save user message
    const { error: userMsgErr } = await supabase
      .from('assistant_messages')
      .insert({ thread_id: threadId, role: 'user', content: message })

    if (userMsgErr) throw userMsgErr

    // Retrieve relevant snippets + external wins/resources (union mode)
    let citations: Citation[] = []
    let retrieved: Array<{ content: string; meta: any; source: any }> = []
    let relevantWins: RelevantItem[] = []
    let helpfulResources: RelevantItem[] = []

    if (mode === 'union') {
      const term = pickSearchTerm(message)
      if (term) {
        const { data: chunks, error: cErr } = await admin
          .from('nalc_chunks')
          .select('content, meta, source_id, chunk_index')
          .ilike('content', `%${term}%`)
          .limit(6)

        if (cErr) throw cErr

        const sourceIds = Array.from(new Set((chunks || []).map((c) => c.source_id).filter(Boolean)))
        let sources: any[] = []
        if (sourceIds.length) {
          const { data: s, error: sErr } = await admin
            .from('nalc_sources')
            .select('id, title, url')
            .in('id', sourceIds)

          if (sErr) throw sErr
          sources = s || []
        }

        retrieved = (chunks || []).map((c) => {
          const source = sources.find((s) => s.id === c.source_id) || null
          return { content: c.content, meta: c.meta, source }
        })

        citations = retrieved
          .map((r) => ({
            source: r.source?.title || 'NALC manual',
            url: r.source?.url || undefined,
            section: r.meta?.section || r.meta?.heading || undefined,
            page: typeof r.meta?.page === 'number' ? r.meta.page : undefined,
          }))
          .filter((c) => c.source)
          .slice(0, 4)

        // External precedent/resources index (metadata + link out)
        // Query by title/notes. Tags-based search can come later.
        const { data: idx, error: iErr } = await admin
          .from('union_precedent_index')
          .select('title, article, doc_type, url, notes')
          .or(`title.ilike.%${term}%,notes.ilike.%${term}%`)
          .limit(10)

        if (iErr) {
          // Non-fatal; keep the answer working even if this table doesn't exist yet.
          console.warn('union_precedent_index lookup failed:', iErr)
        } else {
          const rows = (idx || []) as any[]
          relevantWins = rows
            .filter((r) => String(r.doc_type || '').toLowerCase() === 'win')
            .slice(0, 5)
            .map((r) => ({
              title: String(r.title || 'Untitled'),
              article: r.article ? String(r.article) : undefined,
              doc_type: r.doc_type ? String(r.doc_type) : undefined,
              url: String(r.url),
              notes: r.notes ? String(r.notes).slice(0, 160) : undefined,
            }))

          helpfulResources = rows
            .filter((r) => String(r.doc_type || '').toLowerCase() === 'resource')
            .slice(0, 5)
            .map((r) => ({
              title: String(r.title || 'Untitled'),
              article: r.article ? String(r.article) : undefined,
              doc_type: r.doc_type ? String(r.doc_type) : undefined,
              url: String(r.url),
              notes: r.notes ? String(r.notes).slice(0, 160) : undefined,
            }))
        }
      }
    }

    // Draft response (until model is enabled)
    let assistantText = ''

    if (mode === 'app') {
      assistantText =
        `${ROUTEWISE_CARRIER_MANUAL}

---

I can help with RouteWise steps. Tell me exactly what screen you’re on and what you’re trying to do (and what you expected to happen).`
    } else {
      if (retrieved.length === 0) {
        assistantText =
          "I’m ready to act like a steward, but I don’t have enough manual text loaded yet to cite confidently. Once M-41 is ingested, I’ll answer with quotes + citations.\n\nIn the meantime: tell me the exact situation (what management said, when, and what they’re trying to make you do)."
      } else {
        assistantText =
          "I found potentially relevant sections in the manuals, but the full AI answer engine (with citation-grounding) isn’t turned on yet.\n\nHere are the top snippets I found; tell me which one matches your situation and I’ll draft the response + grievance starter once the model is enabled."

        // Append snippets (short)
        assistantText += '\n\n---\n'
        for (const r of retrieved.slice(0, 3)) {
          const snippet = String(r.content || '').trim().slice(0, 600)
          assistantText += `\n${snippet}${snippet.length >= 600 ? '…' : ''}\n`
        }
      }
    }

    // Save assistant message
    const { error: asstErr } = await supabase
      .from('assistant_messages')
      .insert({
        thread_id: threadId,
        role: 'assistant',
        content: assistantText,
        citations: citations.length ? citations : null,
        metadata: {
          mode,
          relevantWins: relevantWins.length ? relevantWins : null,
          helpfulResources: helpfulResources.length ? helpfulResources : null,
        },
      })

    if (asstErr) throw asstErr

    // Touch thread updated_at
    await supabase.from('assistant_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)

    return json(200, {
      ok: true,
      threadId,
    })
  } catch (e) {
    return json(500, { ok: false, error: String((e as any)?.message || e) })
  }
})
