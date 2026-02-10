# Admin helper scripts (local-only)

These scripts let Dana do common admin tasks (like confirming emails) without clicking around Supabase.

## One-time setup (local)

1) Create token file (DO NOT COMMIT):

```bash
mkdir -p /home/dana/clawd/secrets
nano /home/dana/clawd/secrets/routewise_admin_token
chmod 600 /home/dana/clawd/secrets/routewise_admin_token
```

Paste the **ADMIN_TOKEN** value (from Supabase Edge Function secrets) into that file.

2) Make scripts executable:

```bash
chmod +x scripts/admin-confirm-email.sh scripts/admin-unverified-users.sh
```

## Confirm a user email

```bash
./scripts/admin-confirm-email.sh kendhammer608@gmail.com
```

## List unverified users

```bash
./scripts/admin-unverified-users.sh
```

## Notes
- Uses the existing Supabase Edge Function: `admin-helper`
- Requires `x-admin-token` header
- Token stays on Dana's machine in `/home/dana/clawd/secrets/`
