#!/usr/bin/env bash
set -euo pipefail

TOKEN_FILE="${ROUTEWISE_ADMIN_TOKEN_FILE:-/home/dana/clawd/secrets/routewise_admin_token}"
SUPABASE_REF="${ROUTEWISE_SUPABASE_REF:-tkmvrdyshxlegzmhrse}"

if [[ ! -f "${TOKEN_FILE}" ]]; then
  echo "Missing admin token file: ${TOKEN_FILE}" >&2
  exit 1
fi

ADMIN_TOKEN="$(cat "${TOKEN_FILE}" | tr -d '\r\n' | sed 's/^ *//;s/ *$//')"
if [[ -z "${ADMIN_TOKEN}" ]]; then
  echo "Admin token file is empty: ${TOKEN_FILE}" >&2
  exit 1
fi

URL="https://${SUPABASE_REF}.supabase.co/functions/v1/admin-helper/unverified-users"

curl -sS \
  -H "content-type: application/json" \
  -H "x-admin-token: ${ADMIN_TOKEN}" \
  -d '{}' \
  "${URL}"

echo
