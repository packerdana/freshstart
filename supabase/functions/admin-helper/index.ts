// Supabase Edge Function: admin-helper
// Allowlisted admin actions protected by a shared token.
//
// Actions:
// - POST /admin-helper/confirm-email  { email }
// - POST /admin-helper/status        { email }
//
// Security:
// - Requires header: x-admin-token: <ADMIN_TOKEN>
//
// Secrets required (set in Supabase → Edge Functions → Secrets):
// - ADMIN_TOKEN
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function requireToken(req: Request) {
  const expected = Deno.env.get('ADMIN_TOKEN')
  if (!expected) throw new Error('Missing ADMIN_TOKEN secret')
  const provided = req.headers.get('x-admin-token')
  if (!provided || provided !== expected) {
    return json(401, { ok: false, error: 'Unauthorized' })
  }
  return null
}

function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url) throw new Error('Missing SUPABASE_URL secret')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY secret')
  return createClient(url, key, { auth: { persistSession: false } })
}

serve(async (req) => {
  // Auth
  const authFail = requireToken(req)
  if (authFail) return authFail

  // Routing
  const url = new URL(req.url)
  const path = url.pathname.replace(/\/+$/, '')

  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'Use POST' })
  }

  let payload: any = null
  try {
    payload = await req.json()
  } catch {
    payload = {}
  }

  const email = String(payload?.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return json(400, { ok: false, error: 'Body must include a valid { email }' })
  }

  const admin = getAdminClient()

  // Helper: find user by email
  async function findUser() {
    // Note: listUsers is paginated. For small tester pools this is fine.
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) throw error
    const user = data.users.find((u) => (u.email || '').toLowerCase() === email)
    return user || null
  }

  try {
    if (path.endsWith('/admin-helper/status')) {
      const user = await findUser()
      if (!user) return json(404, { ok: false, error: 'User not found' })
      return json(200, {
        ok: true,
        email,
        userId: user.id,
        emailConfirmedAt: user.email_confirmed_at,
        createdAt: user.created_at,
      })
    }

    if (path.endsWith('/admin-helper/confirm-email')) {
      const user = await findUser()
      if (!user) return json(404, { ok: false, error: 'User not found' })

      const { data, error } = await admin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      })
      if (error) throw error

      return json(200, {
        ok: true,
        email,
        userId: user.id,
        emailConfirmedAt: data.user?.email_confirmed_at,
      })
    }

    return json(404, { ok: false, error: 'Unknown endpoint' })
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) })
  }
})
