# admin-helper (Supabase Edge Function)

This Edge Function gives Dana a quick way to confirm tester emails (and check status) **without** sending Supabase invite emails.

## What it does

Endpoints (POST):
- `/admin-helper/status` — check if a user exists + whether their email is confirmed
- `/admin-helper/confirm-email` — force-confirm the user’s email

## Security

Requires a shared secret header:
- `x-admin-token: <ADMIN_TOKEN>`

## Setup (Supabase Dashboard)

1) Go to **Edge Functions** → **Create function** → name it: `admin-helper`
2) Paste `index.ts` contents.
3) Set secrets in **Edge Functions → Secrets**:
   - `ADMIN_TOKEN` = make a long random token
   - `SUPABASE_URL` = your project URL (https://xxxx.supabase.co)
   - `SUPABASE_SERVICE_ROLE_KEY` = service role key (keep private)
4) Deploy.

## Use

Replace `<PROJECT_REF>` and `<ADMIN_TOKEN>`.

### Check status
```bash
curl -s \
  -H "x-admin-token: <ADMIN_TOKEN>" \
  -H "content-type: application/json" \
  -d '{"email":"tester@example.com"}' \
  https://<PROJECT_REF>.functions.supabase.co/admin-helper/status
```

### Confirm email
```bash
curl -s \
  -H "x-admin-token: <ADMIN_TOKEN>" \
  -H "content-type: application/json" \
  -d '{"email":"tester@example.com"}' \
  https://<PROJECT_REF>.functions.supabase.co/admin-helper/confirm-email
```

## Notes
- This is intentionally allowlisted and minimal.
- If your tester pool grows beyond 1000 users, we’ll switch to a safer lookup method than listUsers.
