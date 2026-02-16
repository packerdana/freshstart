# Nightly Log

## 2026-02-16 — Card padding on small screens
- Task: Improve spacing on small phones by reducing default card padding.
- Change: `.card` now uses `p-4 md:p-6` (was `p-6`).
- Files: src/index.css
- Build: ✅ `npm run build` passed.
- Patch: larry-os/patches/2026-02-16-card-padding.patch
- Branch: ui-polish/2026-02-16-card-padding

## 2026-02-16 — Standardize card header titles
- Task: Standardize card headers (font size + weight).
- Change: Added a shared `.card-title` class and replaced repeated `text-lg font-bold text-gray-900` headers with `card-title` across screens/modals.
- Files: src/index.css; multiple `src/components/**` files.
- Build: ✅ `npm run build` passed.
- Patch: larry-os/patches/2026-02-16-standardize-card-headers.patch
- Branch: ui-polish/2026-02-16-standardize-card-headers
