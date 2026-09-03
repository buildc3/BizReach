# Architecture — Folder Structure & Boundaries

How the app is actually organized, and where each kind of code belongs. Two processes, one product. Data flow:

```
Browser (http://localhost:3000)
   │  same-origin fetch — src/lib/api.ts → /api/v1/*
   ▼
Next.js app (next-app/)         ──►  PostgreSQL (Docker: postgres-client, via Prisma)
   │  app/api/v1/**/route.ts    ──►  Groq API (AI pitches)
   │  (backend, same process)   ──►  Google Places API (scraping)
   ▼  HTTP — http://127.0.0.1:3099
Baileys sidecar (sidecar/)  ──►  WhatsApp
```

There is **no separate backend process** — `app/api/v1/**/route.ts` route handlers ARE the backend, running inside the same Next.js server that serves pages. This is what makes the in-process send-queue worker viable: it's a long-lived Node process (`next dev` / `next start`), not a serverless function.

---

## next-app/ — Next.js App Router (frontend + backend, one process)

```
next-app/
├── package.json
├── .env                        # DATABASE_URL, GROQ_API_KEY, GOOGLE_PLACES_API_KEY, SIDECAR_URL — never committed
├── prisma.config.ts            # Prisma 7 config — datasource URL, migrations path
├── prisma/
│   ├── schema.prisma           # all 7 models, camelCase fields via @map, PascalCase model names
│   └── migrations/             # Prisma Migrate history (0_init = baseline against the pre-existing DB)
└── src/
    ├── instrumentation.ts      # register() — starts the send-queue boot re-scan once per server start
    ├── proxy.ts                # Next 16's renamed middleware — first-line auth gate (redirect/401), see .ai/patterns.md §12
    ├── app/
    │   ├── layout.tsx          # root layout: fonts (next/font), Providers only — no Sidebar here
    │   ├── providers.tsx       # "use client" — QueryClientProvider
    │   ├── globals.css         # Tailwind v4 @theme — ALL design tokens (see .ai/design.md)
    │   ├── (app)/               # route group: authenticated pages, wrapped in the Sidebar shell
    │   │   ├── layout.tsx       # Sidebar + main wrapper (moved out of root layout for the (auth) split below)
    │   │   ├── page.tsx          # "/" = Searches (the flow's entry point)
    │   │   ├── leads/page.tsx
    │   │   ├── templates/page.tsx  # template CRUD (was "Pitches" pre-migration — renamed, see .ai/project.md)
    │   │   ├── messages/page.tsx
    │   │   ├── products/page.tsx
    │   │   └── settings/page.tsx
    │   ├── (auth)/               # route group: login/signup, no Sidebar
    │   │   ├── layout.tsx        # centered, minimal — no Sidebar
    │   │   ├── login/page.tsx
    │   │   └── signup/page.tsx
    │   └── api/
    │       ├── auth/             # signup/login/logout/me — NOT under /v1, proxy matcher exempts this prefix
    │       └── v1/                # ALL other route handlers, one folder per resource/action, mirrors the old axum routes 1:1
    │           ├── searches/, leads/, groups/, templates/, products/, pitches/, messages/, settings/, whatsapp/
    │           └── each: route.ts (list/create) and/or [id]/route.ts, [id]/<action>/route.ts — every handler starts with `await requireUser(req)`
    ├── components/
    │   ├── layout/              # Sidebar (incl. logout + current-user), TopBar, Spinner, ErrorState
    │   ├── pitches/              # GroupPitchDrawer (the real pitch review/send UI)
    │   └── ui/                   # shadcn/ui copy-in — button, card, dialog, input, label, textarea ("use client")
    ├── hooks/                   # one file per resource: useLeads, useGroups, usePitches, useAuth, ... ALL TanStack Query usage lives here
    ├── lib/
    │   ├── db.ts                # Prisma client singleton (globalThis-guarded against dev hot-reload duplication)
    │   ├── env.ts                # zod-validated env, read once (incl. JWT_SECRET)
    │   ├── errors.ts             # AppError + { success, code, message } envelope + withRoute() wrapper
    │   ├── auth.ts                # JWT sign/verify (jose), bcrypt password hashing, requireUser(req), cookie helpers
    │   ├── schemas.ts            # SERVER-side zod input validation (route handlers) — mirrors DB CHECK constraints Prisma doesn't enforce; also signup/login schemas
    │   ├── form-schemas.ts       # CLIENT-side zod schemas for React Hook Form — do not confuse with schemas.ts
    │   ├── api.ts                 # the ONLY fetch layer on the client — typed api.<resource>.<verb>(), same-origin paths; auto-redirects to /login on a 401
    │   ├── utils.ts               # cn() helper, date formatting
    │   ├── repo/                  # Prisma calls ONLY — one file per resource, no route/HTTP concerns here. Every fn takes `userId` and scopes its query (directly for Search/Product/Template/Lead/SenderProfile, via a parent join for Group/Message)
    │   └── services/               # external I/O: scraper.ts (Places), pitch.ts (Groq), whatsapp.ts (sidecar client), send-queue.ts (rate-limited worker — uses the `*Internal` unscoped repo fns, see .ai/patterns.md §12)
    ├── stores/                    # Zustand: useUIStore, useSettingsStore — UI-only state
    ├── types/index.ts             # client-side TS mirrors of Prisma models (camelCase)
    └── generated/prisma/           # Prisma-generated client — DO NOT hand-edit, gitignored, regenerated by `prisma generate`
```

### Layer rules

- **route handler → repo/service → Prisma/external API.** A route file (`route.ts`) starts with `const userId = await requireUser(req)`, validates input (zod, `lib/schemas.ts`), calls one or more `lib/repo/*` / `lib/services/*` functions (passing `userId`), and returns `ok(data)` or lets `withRoute()` catch a thrown `AppError`. No Prisma calls and no external `fetch` directly inside a route handler.
- **`lib/repo/*.ts`**: the only place Prisma Client is called (besides `send-queue.ts`, which needs a raw query to re-scan stranded rows). Returns Prisma model types or small derived shapes (e.g. `PitchWithLead` in `repo/pitches.ts`).
- **`lib/services/*.ts`**: external I/O (Groq, Google Places, the Baileys sidecar) and the long-running send-queue worker. No Next.js request/response types in here.
- **`lib/db.ts` / `lib/services/send-queue.ts`** use a `globalThis`-guarded singleton pattern — required because Next.js dev-mode hot-reloads modules but keeps `globalThis`, so a naive module-level singleton would duplicate on every edit.
- **pages → hooks → lib/api.ts.** Components never call `fetch` or `api.*` directly — always through a hook in `hooks/`.
- **`lib/api.ts` is the single HTTP boundary on the client.** Every endpoint gets a typed method there; `request<T>` unwraps the `{ success, data }` envelope and throws the error shape on non-OK.
- **TanStack Query owns server state**, **Zustand owns UI-only state** (sidebar, active search/lead selection, follow-up day threshold). Never mirror server data into Zustand.
- **Types**: `types/index.ts` (client) mirrors the Prisma schema field-for-field in camelCase; the Prisma-generated types (`generated/prisma/`) are the server-side source of truth — keep them in sync manually since they're maintained separately (client types aren't generated from Prisma to keep the client bundle free of server code).
- New route = new folder under `app/api/v1/` + a `route.ts` + a repo fn + an `lib/api.ts` method + a hook.
- New page = new folder under `app/` + `page.tsx` (default export, `"use client"` if it uses hooks/state — nearly all pages do) + a Sidebar link.
- Long-running work (scrapes, batch pitch generation) uses a fire-and-forget async IIFE (`void (async () => {...})()`) inside the route handler, returns `"started"` immediately, and the frontend polls a list endpoint (`refetchInterval`) for results — same spawn+poll shape as the old Rust `tokio::spawn`, just without a task supervisor, so per-item failures must be caught and logged inside the loop rather than allowed to reject silently.

---

## sidecar/ — WhatsApp bridge (keep it dumb, unchanged by the migration)

```
sidecar/
├── index.js                # entire service: Express app + Baileys socket (~220 lines)
└── package.json             # start, bundle (esbuild), build (pkg)
```

- Three endpoints only: `GET /api/status` (connected + QR data URL), `POST /api/send` (`{ phone, message }`), `POST /api/logout`.
- The sidecar holds **no business logic** — pacing, retries, status transitions all belong in `next-app/src/lib/services/send-queue.ts`. The frontend never calls the sidecar directly; the Next.js route handlers proxy (`app/api/v1/whatsapp/*` → `lib/services/whatsapp.ts`).

---

## Where does new code go?

| You're adding… | It goes in… |
|---|---|
| A new API endpoint | `app/api/v1/<resource>/[...]/route.ts` + a repo fn(s) + `lib/api.ts` method + a hook |
| A DB table/column | `prisma/schema.prisma` + `npx prisma migrate dev --name ...` + `lib/repo/*` + `lib/schemas.ts` (if it's a status/enum-like field, since Prisma won't enforce the DB `CHECK`) |
| An external integration (API, AI) | `next-app/src/lib/services/` |
| A new screen | `app/<route>/page.tsx` + Sidebar entry (`components/layout/Sidebar.tsx`) |
| A reusable widget | `src/components/<feature>/`, or `src/components/ui/` only if it's a shadcn primitive |
| Form validation | `lib/form-schemas.ts` (zod, client) — and re-validate in the route handler via `lib/schemas.ts` |
| A background job | fire-and-forget async IIFE in a route handler (poll pattern), or a dedicated singleton worker like `services/send-queue.ts` |
