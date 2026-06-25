# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # dev server (SSR, port 4321)
npm run build     # production build
npm run preview   # preview production build
npm run check     # TypeScript + Astro diagnostics (run before committing)
```

## Architecture

**SSR project** — `output: 'server'` with `@astrojs/node` standalone adapter. Every page and API route runs server-side by default.

**Path alias:** `@/` maps to `src/`. Use it everywhere (`@/components/...`, `@/types/...`).

### Style system (`src/styles/`)

- `globals.css` — single entry point: `@import "tailwindcss"` + `@theme` tokens + `@layer base`. **Import this in every layout/page.**
- `nodehive-editor.css` — editor-only styles; imported alongside `globals.css` in layouts that need the visual editor.

**Tailwind v4** — configured as a Vite plugin (`@tailwindcss/vite`). No `tailwind.config.js`. Custom tokens live in `@theme` inside `globals.css`.

**Brand tokens** (use as Tailwind utilities: `bg-egrem-red`, `text-egrem-gold`, etc.):
| Token | Value | Use |
|---|---|---|
| `--color-egrem-red` | `#FF0000` | CTAs, accents |
| `--color-egrem-gold` | `#CC9933` | Links, interactive, secondary brand |
| `--color-egrem-gray` | `#808080` | Borders, disabled, secondary text |
| `--color-egrem-black` | `#000000` | Body text, structure |

**Font families** (as Tailwind utilities: `font-display`, `font-script`, `font-sans`):
- `font-display` → Myriad Pro Cond Bold (weight 700) — headings, institutional names
- `font-sans` → Myriad Pro Light (weight 300) — body text (default on `<html>`)
- `font-script` → Ravellin — slogans only (`.slogan` or `data-font="script"`)

Font files live in `public/fonts/` (.woff + .otf pairs for Myriad Pro, .ttf for Ravellin).

### NodeHive Visual Editor (`src/components/nodehive/`)

Integration with the NodeHive/Drupal Visual Editor. The system activates when the page is loaded inside a Drupal iframe, adding class `nh-editor` to `<html>`.

**Components:**
- `NodeHiveConnector` — postMessage bridge to Drupal. Include **once** per layout at the end of `<body>`.
- `NodeHiveToolbar` — floating editor bar. Include at the **start** of `<body>`.
- `NodeHiveEntity` — wrapper for editable paragraphs/fragments. Emits Drupal data-attributes.
- `NodeHiveField` — marks individual fields as editable (or use `data-nodehive-field` directly on HTML elements).
- `NodeHiveEditButton` — edit button, auto-included by `NodeHiveEntity`.

**Required in layout `<head>`:**
```astro
<script define:vars={{ nodehiveBaseUrl: import.meta.env.NODEHIVE_BASE_URL, nodehiveLang: lang }}>
  window.__NODEHIVE_BASE_URL__ = nodehiveBaseUrl;
  window.__NODEHIVE_LANG__     = nodehiveLang;
</script>
<meta http-equiv="X-Frame-Options" content="ALLOWALL" />
```

**API routes:**
- `POST /api/nodehive/revalidate` — called by the connector after Drupal saves changes
- `GET /nodehive/login` — auth handshake page for Drupal tokens

**Environment variables** (see `.env.example`):
```
NODEHIVE_BASE_URL=https://tu-drupal.com
NODEHIVE_EDITOR_DEV_MODE=true   # optional: activates editor UI without Drupal
```

**Debug in browser:**
```js
localStorage.setItem('__NODEHIVE_DEBUG__', '1');        // verbose connector logs
document.documentElement.classList.add('nh-editor');    // simulate editor mode
```
