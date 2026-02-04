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
  if (!expected) {
    return json(500, { ok: false, error: 'Server misconfigured: missing ADMIN_TOKEN secret' })
  }
  const provided = req.headers.get('x-admin-token')
  if (!provided || provided !== expected) {
    return json(401, { ok: false, error: 'Unauthorized' })
  }
  return null
}

function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url) throw new Error('missing SUPABASE_URL secret')
  if (!key) throw new Error('missing SUPABASE_SERVICE_ROLE_KEY secret')
  return createClient(url, key, { auth: { persistSession: false } })
}

serve(async (req) => {
  try {
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
    const action = String(payload?.action || '').trim().toLowerCase() // optional

    if (!email || !email.includes('@')) {
      return json(400, { ok: false, error: 'Body must include a valid { email }' })
    }

    let admin
    try {
      admin = getAdminClient()
    } catch (e) {
      return json(500, { ok: false, error: `Server misconfigured: ${String(e?.message || e)}` })
    }

  // Helper: find user by email
  async function findUser() {
    // Note: listUsers is paginated. For small tester pools this is fine.
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) throw error
    const user = data.users.find((u) => (u.email || '').toLowerCase() === email)
    return user || null
  }

  try {
    const wantsStatus = path.endsWith('/admin-helper/status') || action === 'status'
    const wantsConfirm = path.endsWith('/admin-helper/confirm-email') || action === 'confirm-email' || action === 'confirm'
    const wantsRouteHistory = path.endsWith('/admin-helper/route-history') || action === 'route-history'
    const wantsRouteHistoryDelete = path.endsWith('/admin-helper/route-history-delete') || action === 'route-history-delete'
    const wantsWaypointsCount = path.endsWith('/admin-helper/waypoints-count') || action === 'waypoints-count'
    const wantsUnverified = path.endsWith('/admin-helper/unverified-users') || action === 'unverified-users'

    if (wantsStatus) {
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

    if (wantsConfirm) {
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

    if (wantsUnverified) {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (error) throw error

      const unverified = (data.users || [])
        .filter((u) => !u.email_confirmed_at)
        .map((u) => ({
          id: u.id,
          email: u.email,
          createdAt: u.created_at,
        }))
        .filter((u) => !!u.email)

      return json(200, {
        ok: true,
        unverifiedCount: unverified.length,
        users: unverified,
      })
    }

    const user = await findUser()
    if (!user) return json(404, { ok: false, error: 'User not found' })

    async function getRouteForUser(routeNumber: string) {
      const { data: route, error: routeErr } = await admin
        .from('routes')
        .select('id, route_number, start_time, tour_length')
        .eq('user_id', user.id)
        .eq('route_number', routeNumber)
        .maybeSingle()

      if (routeErr) throw routeErr
      return route
    }

    if (wantsRouteHistory) {

      const routeNumber = String(payload?.routeNumber || payload?.route_number || '').trim()
      const days = Math.max(1, Math.min(365, Number(payload?.days || 60)))

      if (!routeNumber) {
        return json(400, { ok: false, error: 'Body must include { routeNumber }' })
      }

      const route = await getRouteForUser(routeNumber)
      if (!route) return json(404, { ok: false, error: 'Route not found for user' })

      // Pull history
      const { data: rows, error: histErr } = await admin
        .from('route_history')
        .select('date, street_time, street_time_normalized, pm_office_time, office_time, overtime')
        .eq('route_id', route.id)
        .order('date', { ascending: false })
        .limit(days)

      if (histErr) throw histErr

      const history = (rows || []).map((r: any) => ({
        date: r.date,
        street_time: r.street_time,
        street_time_normalized: r.street_time_normalized,
        pm_office_time: r.pm_office_time,
        office_time: r.office_time,
        overtime: r.overtime,
      }))

      // Flag suspicious street times
      const suspicious = history
        .map((r: any) => {
          const st = Number(r.street_time_normalized ?? r.street_time ?? 0) || 0
          const pm = Number(r.pm_office_time ?? 0) || 0
          const ot = Number(r.overtime ?? 0) || 0

          const flags: string[] = []
          if (st > 0 && st < 120) flags.push('street_time_low')
          if (st > 600) flags.push('street_time_high')
          if (pm > 60) flags.push('pm_office_high')
          if (ot < -120) flags.push('undertime_large')
          if (ot > 180) flags.push('overtime_large')

          return flags.length ? { ...r, st, pm, ot, flags } : null
        })
        .filter(Boolean)

      return json(200, {
        ok: true,
        email,
        userId: user.id,
        route: {
          id: route.id,
          route_number: route.route_number,
          start_time: route.start_time,
          tour_length: route.tour_length,
        },
        daysRequested: days,
        history,
        suspicious,
      })
    }

    if (wantsRouteHistoryDelete) {
      const routeNumber = String(payload?.routeNumber || payload?.route_number || '').trim()
      const date = String(payload?.date || '').trim()

      if (!routeNumber || !date) {
        return json(400, { ok: false, error: 'Body must include { routeNumber, date }' })
      }

      const route = await getRouteForUser(routeNumber)
      if (!route) return json(404, { ok: false, error: 'Route not found for user' })

      const { error: delErr } = await admin
        .from('route_history')
        .delete()
        .eq('route_id', route.id)
        .eq('date', date)

      if (delErr) throw delErr

      return json(200, {
        ok: true,
        email,
        userId: user.id,
        routeId: route.id,
        routeNumber: route.route_number,
        deletedDate: date,
      })
    }

    if (wantsWaypointsCount) {
      const routeNumber = String(payload?.routeNumber || payload?.route_number || '').trim()
      const date = payload?.date != null ? String(payload.date).trim() : null

      if (!routeNumber) {
        return json(400, { ok: false, error: 'Body must include { routeNumber }' })
      }

      const route = await getRouteForUser(routeNumber)
      if (!route) return json(404, { ok: false, error: 'Route not found for user' })

      let query = admin
        .from('waypoints')
        .select('id', { count: 'exact', head: true })
        .eq('route_id', route.id)

      if (date) query = query.eq('date', date)

      const { count, error: countErr } = await query
      if (countErr) throw countErr

      return json(200, {
        ok: true,
        email,
        userId: user.id,
        routeId: route.id,
        routeNumber: route.route_number,
        date: date || null,
        waypointCount: count || 0,
      })
    }

    return json(404, { ok: false, error: 'Unknown endpoint. Use /status, /confirm-email, /route-history, or include { action }.' })
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) })
  }
  } catch (e) {
    // Catch anything thrown before our inner try/catch (misconfigured secrets, etc.)
    return json(500, { ok: false, error: String(e?.message || e) })
  }
})
