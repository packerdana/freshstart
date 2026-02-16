# MEMORY.md - Long-term memory (curated)

## Dana preferences / working style
- Collaboration style: Dana prefers I “take the wheel” and implement fixes directly.
- Risk tolerance: No surprises (cautious/test-first changes).
- Tooling preference: Use Codex for all coding.
- RouteWise #1 must-have: Great predictions.
- Quality bar: Bug-free + fast + simple + accurate.
- Availability: Usually after 5:00 PM CST (America/Chicago).
- Hard line/value: Never take management’s side.

## Dana background / mission
- Dana is a USPS letter carrier (started 1991), planning to retire May 2027.
- Goal: ship RouteWise to help thousands of letter carriers nationwide.

## Logistics / purchases
- Dana bought a Mac mini; expects delivery Monday 2026-02-16 (FedEx tracking #512439918027).
- Mac mini specs (Dana):
  - Model: Mac mini (2024), silver; Model # MCYT4LL/A; UPC 195949942969; SKU 6566917; BSIN JJGCQ84LWK
  - Chip: Apple M4 (10‑core CPU); Integrated Apple M4 10‑core GPU
  - Memory: 24GB RAM
  - Storage: 512GB SSD
  - OS: macOS Sequoia 15.1
  - Ports: 3× Thunderbolt 4, 1× HDMI, 1× Ethernet; USB-C ports total listed as 5 (2× USB‑C 3.2 + 3× USB‑C)
  - Size/weight: 2" H × 5" W × 5" D; 1.5 lb
  - No keyboard/mouse; no optical drive; 1‑year Apple limited warranty

## RouteWise product decisions
- Pricing preference: $4.99/month subscription model.

## RouteWise growth / marketing tools (remember)
- High-value tools to suggest when relevant:
  - Descript (demo videos + captions)
  - Gamma (one-pagers/decks)
  - Make (make.com) (automation: leads/support)
  - SocialSweep (giveaways to grow list)
  - ChatGPT/Claude (copywriting, FAQs, support scripts)
- Maybe later: ElevenLabs (voiceover), NotebookLM (docs/support brain), Membership.io (portal/community)

## RouteWise code / repo
- GitHub repo: packerdana/freshstart (remote: git@github.com-routewise:packerdana/freshstart.git)

## RouteWise recurring bugs / gotchas
- "Fix this day" is minutes-only and updates route_history overrides; timer-based (operation_codes) rows can be stale/misleading if displayed as timestamp ranges. Stats → Day History expanded rows were updated (PR #2, Feb 2026) to show core 721/722/744 rows as "(fixed)" when overrides are present.
- Mobile refresh/eviction can wipe local state mid-route. Volumes/timers should autosave to Supabase, but if saves fail silently (offline/auth/schema mismatch), Dana may see "lost office volumes" or missing timers after reload. Address by making autosave failures visible + retrying, and ensuring DB schema matches expected columns.
- Supabase/PostgREST error observed: PGRST204 missing column `cased_boxholder` on `route_history` (schema cache). Fix by adding columns (has_boxholder, cased_boxholder, cased_boxholder_type) and reloading schema (`notify pgrst, 'reload schema';`).

## Key references (NALC)
- M-41 (City Delivery Carriers Duties and Responsibilities), June 2019 (PDF):
  https://www.nalc.org/workplace-issues/resources/body/M-41-City-Delivery-Carriers-Duties-and-Responsibilities-June-2019.pdf
  (Index page: https://www.nalc.org/workplace-issues/resources/usps-handbooks-and-manuals)
