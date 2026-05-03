# FYM Command Center

Frontend for the FYM lead-gen ops platform — built with the same design language as [Orin](https://app.orinsuite.com).

The backend (the `fym-agent` engine, GHL sync, Anthropic / ElevenLabs integrations, follow-up cadence, banned-phrase enforcement) lives on the VPS at `76.13.214.35`. This repo is **frontend only** — it talks to the engine via HTTP and Server-Sent Events.

```
┌──────────────────────┐         ┌──────────────────────┐
│  command.fymfin..    │  HTTPS  │  api.fymfinancial..  │
│  Netlify (this repo) │ ──────► │  Caddy → VPS :8080   │
│  Vite + React 19     │         │  fym-agent (Node)    │
└──────────────────────┘         └──────────────────────┘
```

## Pages

| Route | Purpose |
| --- | --- |
| `/`              | **Live Feed** — stat cards + real-time activity stream (SSE) |
| `/conversations` | **Conversations** — 3-pane (thread list / messages / contact panel). The gem. |
| `/contacts`      | **Contacts** — table with search, stage filter, lead score |
| `/pipeline`      | **Pipeline** — kanban by lead stage |
| `/train-ai`      | **Train AI** — CRUD on `feedback_rules` table; rules are injected into every prompt at runtime as `LEARNED RULES` |
| `/settings`      | **Settings** — per-workspace config (engine, follow-ups, voice, business hours) |
| `/workspaces`    | **Workspaces** — card grid showing status, contacts, and 24h volume across every workspace |

## Stack

- **Vite 8** + **React 19** + **TypeScript**
- **Tailwind CSS 4** (CSS-variable theme, no config file — see `src/index.css`)
- **React Router 7** for routing
- **Lucide React** for icons
- Native `fetch` + `EventSource` (no extra data lib — keeps the bundle tight)
- 0 runtime deps beyond React + Router + Lucide

Production build is **~305 KB JS / 93 KB gzipped**.

## Local development

```bash
npm install
cp .env.example .env.local
# Edit .env.local — set VITE_API_BASE to your tunnel/VPS URL and VITE_ADMIN_TOKEN
npm run dev
```

Vite proxies `/api/*` to `VITE_API_BASE` in dev so you don't hit CORS. In production the browser hits `VITE_API_BASE` directly and the backend must allow CORS (see "VPS setup" below).

Open http://localhost:5180 — workspaces, contacts, conversations, and live feed pull from the real engine.

## Production build

```bash
npm run build       # tsc + vite build → dist/
npm run preview     # serve dist/ locally
```

## Netlify deploy

1. **New site** → connect this repo (`profit-scale/fym-command-center`).
2. **Build settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
3. **Environment variables:**
   - `VITE_API_BASE` = `https://api.fymfinancial.com`
   - `VITE_ADMIN_TOKEN` = the bearer token from `/opt/fym-agent/.admin-token`
4. **Custom domain:** point `command.fymfinancial.com` at the Netlify site, enable HTTPS.

`_redirects` is included at the project root so client-side routing works on Netlify (every path falls through to `/index.html`).

## VPS setup (one-time)

The frontend on Netlify needs a clean public URL for the API. Recommended: **Caddy** on the VPS.

```bash
# /etc/caddy/Caddyfile
api.fymfinancial.com {
  encode gzip
  reverse_proxy localhost:8080

  # CORS — locked to our Netlify origins
  @cors header Origin https://command.fymfinancial.com
  header @cors {
    Access-Control-Allow-Origin "https://command.fymfinancial.com"
    Access-Control-Allow-Methods "GET, POST, PATCH, DELETE, OPTIONS"
    Access-Control-Allow-Headers "Content-Type, Authorization"
    Access-Control-Allow-Credentials "true"
  }
  @options method OPTIONS
  respond @options 204
}
```

Then point `api.fymfinancial.com` DNS at `76.13.214.35` and `systemctl reload caddy`. Caddy handles Let's Encrypt automatically.

If you'd rather stay on Cloudflare Tunnel for now, set `VITE_API_BASE` to the trycloudflare URL and add CORS to the Express app inside `fym-agent` (`/opt/fym-agent/src/index.js`).

## Design language

This app mirrors [Orin Admin](../orin-admin) — same Inter typeface, same dark-slate / indigo / violet palette, same `rounded-2xl` / backdrop-blur surface treatment, same gradient accents. The accent palette nudges slightly cooler (touch of cyan) so the two products feel related but not identical.

Theme tokens live in [`src/index.css`](src/index.css) under `@theme`. To change a color or radius, edit it there — Tailwind 4 picks it up at build time.

## Project layout

```
src/
├── App.tsx                    Top-level routes
├── main.tsx                   Vite entry
├── index.css                  Tailwind 4 @theme + global styles
├── components/
│   ├── conversations/         ThreadList, MessageThread, MessageBubble, ContactPanel
│   ├── layout/                Shell, Sidebar, Topbar, WorkspaceSwitcher
│   └── ui/                    Avatar, Badge, Banner, Button, Card, EmptyState,
│                              Input, Modal, Skeleton, StatCard, Tabs
├── lib/
│   ├── api.ts                 fetch wrapper, bearer auth, SSE subscribe
│   ├── format.ts              timeAgo, formatPhone, parseTags, parseMetadata, cn
│   ├── toast.tsx              <ToastProvider> + useToast()
│   ├── types.ts               API DTOs
│   └── workspace.tsx          <WorkspaceProvider> + useWorkspace()
├── pages/
│   ├── Conversations.tsx
│   ├── Contacts.tsx
│   ├── LiveFeed.tsx
│   ├── Pipeline.tsx
│   ├── Settings.tsx
│   ├── TrainAI.tsx
│   └── Workspaces.tsx
└── vite-env.d.ts
```

## License

Internal — © FYM Financial / NCT Media.
