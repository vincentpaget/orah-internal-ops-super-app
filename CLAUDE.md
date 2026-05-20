@AGENTS.md

# Orah Internal Ops Hub

A single internal Next.js app that consolidates four previously separate Vercel tools into one deployment with shared Salesforce OAuth login. Built by Vincent Paget (vincent@orah.com).

## What this is

Four tools that used to live in separate GitHub repos and Vercel deployments:

| Tool | Old repo | Route in this app |
|------|----------|-------------------|
| Pipeline Review | orah-pipeline-hygiene-app | `/pipeline` |
| CRM Dedupe | orah-crm-dedupe | `/dedupe` |
| Event Lead Pipeline | orah-event-lead-pipeline | `/event-leads` |
| Campaign Setup | orah-campaign-setup-app | `/campaign-setup` |

All four share Salesforce OAuth login. The home page at `/` shows a tool-picker grid.

---

## Current state (as of session handoff)

### Done
- Next.js 16 + React 19 + Tailwind v4 scaffold
- Salesforce OAuth PKCE login (`/login`, `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`)
- JWT session management (`lib/session.ts`)
- AppShell layout with navy TopBar ("Orah Ops Hub") + collapsible NavBar (all 4 tools)
- Home page at `/` with tool-picker grid (4 cards)
- `(app)` route group — any page under `app/(app)/` is auth-gated via `app/(app)/layout.tsx`
- `.env.local.example` with all required env vars
- Git initialised, initial commit on `main`

### In progress / next up
Authentication is being tested locally on `http://localhost:3001`. The `.env.local` needs to be created from `.env.local.example` before auth works. Once auth is confirmed working, the next task is **migrating the Pipeline Review tool** (Phase 2).

---

## Running locally

```bash
npm run dev -- --port 3001
```

Then visit `http://localhost:3001`. You'll be redirected to `/login` until `.env.local` is configured.

### Minimum env vars to test auth

Create `.env.local` (never commit this file):

```
SF_OAUTH_CLIENT_ID=        # Consumer Key from Salesforce Connected App
SF_OAUTH_CLIENT_SECRET=    # Consumer Secret from Salesforce Connected App
SF_OAUTH_REDIRECT_URI=http://localhost:3001/api/auth/callback
SF_MY_DOMAIN=orah.my.salesforce.com
SF_ORG_ID=                 # Optional — restricts login to your org only
SESSION_SECRET=            # Run: openssl rand -hex 32
```

The Salesforce Connected App callback URL must include `http://localhost:3001/api/auth/callback` for local dev, and the production Vercel URL for prod.

---

## Architecture

```
app/
  layout.tsx               # Root layout — Open Sans font, metadata
  globals.css              # Full Orah CSS token system + Tailwind v4
  page.tsx                 # Home at `/` — checks session, shows tool picker or redirects to /login
  login/page.tsx           # Login page — Salesforce OAuth entry point
  api/auth/
    login/route.ts         # Initiates PKCE OAuth flow
    callback/route.ts      # Handles Salesforce redirect, creates session cookie
    logout/route.ts        # Clears session, redirects to /login
  (app)/
    layout.tsx             # Auth gate — reads session cookie, redirects to /login if missing
    # (tool pages go here)

components/layout/
  AppShell.tsx             # Client component — accepts userName prop, renders TopBar + NavBar + main
  TopBar.tsx               # Navy header with logo, "Orah Ops Hub" title, user initials, sign out
  NavBar.tsx               # Collapsible sidebar with links to all 4 tools

lib/
  session.ts               # JWT sign/verify, sessionCookie(), clearSessionCookie(), parseCookies()

public/
  assets/                  # Orah logo SVGs
  fonts/                   # Sofia Pro (brand display font)
```

### Auth flow
1. User hits any protected route → `(app)/layout.tsx` checks session cookie → redirects to `/login`
2. `/login` page has "Sign in with Salesforce" → hits `/api/auth/login`
3. Login route generates PKCE state/verifier, redirects to Salesforce
4. Salesforce redirects back to `/api/auth/callback`
5. Callback validates state, exchanges code for token, fetches identity, sets JWT session cookie
6. User lands at `/` (home page)

### CSS / styling
All styling uses CSS custom properties defined in `app/globals.css`. Key tokens:
- `--navy-900: #002744` — primary brand colour (TopBar background)
- `--blue-500: #0073e6` — links, active states
- `--font-display` — Sofia Pro (headings)
- `--font-sans` — Open Sans (body)
- `--bg`, `--fg`, `--border`, `--shadow-1` etc. — semantic tokens

No component library (no shadcn). All components use inline styles with CSS token variables.

---

## Migration plan (remaining work)

### Phase 2 — Pipeline Review (easiest, already Next.js)
Source: `/Users/vincentpaget/Documents/Claude/pipeline-review-app`

- Copy `app/(app)/pipeline/` and `app/(app)/my-pipeline/` routes verbatim
- Copy `components/pipeline/` verbatim
- Copy pipeline-specific lib files (Salesforce data fetching, types, mock data)
- Add to `.env.local`: `SF_USERNAME`, `SF_PASSWORD`, `SF_SECURITY_TOKEN`, `SLACK_TOKEN`

### Phase 3 — CRM Dedupe (medium)
Source: `/Users/vincentpaget/Documents/Claude/orah-crm-deduplication-pipeline`

- Convert `api/hubspot-ops.js` → `app/api/dedupe/hubspot/route.ts`
- Convert `api/salesforce-ops.js` → `app/api/dedupe/salesforce/route.ts`
- Rewrite `public/index.html` (2456-line vanilla JS SPA) as React page + components:
  - `DedupeUpload` — CSV file input
  - `ClusterList` — paginated cluster table with filters
  - `ClusterCard` — single cluster comparison + master selection
  - `MergeControls` — bulk merge trigger + progress
  - `ActivityLog` — timestamped action log
- Extract `unionFind`, `parseCSV`, `selectMaster` logic into `lib/dedupe.ts`
- Add to `.env.local`: `HUBSPOT_ACCESS_TOKEN`

### Phase 4 — Event Lead Pipeline (medium)
Source: `/Users/vincentpaget/Documents/Claude/orah-event-lead-pipeline-main`

- Convert 3 API files → `app/api/event-leads/` route handlers
- Rewrite `public/index.html` (788-line vanilla JS SPA) as React page + components:
  - `NotionUrlInput`, `CsvUpload`, `LeadTable`, `TriggerButton`
- Multi-step Claude pipeline (parse → dedup → notes → email) stays server-side
- Add to `.env.local`: `NOTION_TOKEN`, `ANTHROPIC_API_KEY`, `N8N_WEBHOOK_EVENT_LEADS`

### Phase 5 — Campaign Setup (medium)
Source: `/Users/vincentpaget/Documents/Claude/orah-campaign-setup-app`

- Convert `api/chat.js` and `api/trigger.js` → Next.js route handlers
- Adapt `src/App.jsx` (520-line React+Vite component) to Next.js page + components:
  - `CampaignForm`, `CampaignPreview`, `CampaignConfirm`
- Add to `.env.local`: `ANTHROPIC_API_KEY`, `N8N_CAMPAIGN_WEBHOOK_DM/WB/EV`

---

## Key design decisions already made

- **No mock auth context** — the super app uses real session data passed as a prop from server components. `AppShell` accepts `userName: string`, not a mock user object.
- **Route group `(app)` for auth** — all tool pages live under `app/(app)/` and inherit the auth check from `app/(app)/layout.tsx`. The root `/` home page handles its own auth check directly in `app/page.tsx`.
- **Inline styles + CSS tokens** — consistent with pipeline-review-app. No Tailwind utility classes on components, no shadcn.
- **`serverExternalPackages`** — `jsforce` and `@slack/web-api` are marked as server-only in `next.config.ts`.
