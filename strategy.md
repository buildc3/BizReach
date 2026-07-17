# Migration Strategy — Rust/axum + Tauri → Next.js Full-Stack + Prisma

> Status: **Implemented (Phases 0–6, code-complete) — pending the user's own functional verification pass.** `next-app/` builds clean; behavior against live DB/Groq/Places/WhatsApp has not been exercised by the implementer. Legacy `backend/`/`lead-gen-app/` left in place, untouched, for comparison.
> Companion tracking file: `progress.md` — see its Phase tracker and Changelog for what actually landed.

## 1. Goal

Replace the three-part stack (Rust axum backend, React+Tauri frontend, Node sidecar) with a **single Next.js application** that owns both frontend and backend, using **Prisma** for all database access. Same PostgreSQL database, same features, same WhatsApp safety guarantees.

## 2. Target Architecture

```
Browser (http://localhost:3000)
   ▼
Next.js app (app/)                      ← pages + components (ported from lead-gen-app)
   │  /api/v1/* Route Handlers          ← ported from backend/src/handlers
   │      ▼
   │  lib/services/*                    ← Groq, Google Places, sidecar client, send-queue worker
   │      ▼
   │  Prisma Client ──► PostgreSQL (same Docker container: postgres-client)
   ▼  HTTP — http://127.0.0.1:3099
Baileys sidecar (unchanged)  ──►  WhatsApp
```

- **Next.js 15+, App Router, TypeScript strict.** Runs as a long-lived local Node server (`next dev` / `next start`) — *not* deployed serverless. This is what makes an in-process background worker viable.
- **API contract is preserved**: the `/api/v1/*` paths and the `{ success, code, message }` / `{ success, data }` envelope stay identical, so the frontend `api.ts` + hooks port with near-zero changes and the two backends can run side-by-side during migration.
- **Sidecar stays a separate process** (recommendation, see §6). It is already Node/ESM; merging it into Next.js would tie the Baileys socket lifetime to dev-server hot reloads and risk repeated WhatsApp re-authentication.
- **Tauri is dropped** (recommendation, see §6). The app becomes a localhost web app opened in the browser. (Tauri cannot host a Next.js server app as a static bundle; re-wrapping later is possible but is a separate effort.)

### Proposed folder layout

```
next-app/
├── prisma/schema.prisma        # introspected from the live DB, then baselined
├── src/
│   ├── app/
│   │   ├── (pages)/            # dashboard, searches, leads, pitches, messages, products, settings
│   │   └── api/v1/[...]/route.ts   # one route handler per resource, same paths as axum
│   ├── components/             # ported as-is: layout/, pitches/, ui/ (shadcn)
│   ├── hooks/                  # ported as-is: TanStack Query hooks
│   ├── lib/
│   │   ├── api.ts              # ported; base URL becomes same-origin /api/v1
│   │   ├── db.ts               # Prisma client singleton
│   │   ├── env.ts              # zod-validated env (replaces config.rs)
│   │   ├── errors.ts           # AppError equivalent + envelope helpers (replaces error.rs)
│   │   ├── schemas.ts          # zod schemas — now ALSO used server-side in route handlers
│   │   └── services/           # scraper.ts, pitch.ts (Groq), whatsapp.ts, send-queue.ts
│   ├── stores/                 # Zustand, ported as-is
│   └── instrumentation.ts      # starts the send-queue worker once per server boot
└── .env                        # DATABASE_URL, GROQ_API_KEY, GOOGLE_PLACES_API_KEY
```

### What each Rust piece maps to

| Rust (backend/) | Next.js equivalent |
|---|---|
| `main.rs` bootstrap | Next server + `instrumentation.ts` (worker start) |
| `config.rs` | `lib/env.ts` (zod-parsed, read once) |
| `error.rs` `AppError` + envelope | `lib/errors.ts` + a `handle()` wrapper for route handlers |
| `routes/mod.rs` + `handlers/*` | `app/api/v1/**/route.ts` (validation via zod, orchestration only) |
| `db/models.rs` + `db/repo.rs` | Prisma schema + `lib/repo/*` (Prisma calls only — no Prisma in route handlers) |
| `db/migrations/*.sql` | Prisma Migrate (baselined on the existing DB — **no data migration needed**) |
| `services/scraper.rs` | `lib/services/scraper.ts` (Google Places fetch) |
| `services/pitch.rs` | `lib/services/pitch.ts` (Groq, OpenAI-compatible fetch) |
| `services/whatsapp.rs` | `lib/services/whatsapp.ts` (fetch to sidecar :3099) |
| `services/send_queue.rs` (tokio worker) | `lib/services/send-queue.ts` in-process worker (see §5 — highest-risk piece) |
| `tokio::spawn` + poll pattern | fire-and-forget async fn + same polling endpoints (pattern unchanged) |

## 3. Phases

**Phase 0 — Scaffold & decisions.** Confirm the §6 decisions. Scaffold `next-app/` (create-next-app: TS strict, Tailwind v4, App Router), add Prisma, shadcn/ui, TanStack Query, Zustand, react-hook-form, zod. Point `.env` at the existing `lead_gen` DB.

**Phase 1 — Data layer.** `prisma db pull` to introspect the live schema → clean up the generated `schema.prisma` (camelCase model fields via `@map`, enums for statuses) → `prisma migrate` **baseline** so the existing DB is marked migrated (no destructive reset). Build `lib/db.ts`, `lib/env.ts`, `lib/errors.ts`. Verify Prisma reads real rows.

**Phase 2 — CRUD resources.** Port repo + handlers for: settings/profile, products, templates, searches (CRUD part), leads, groups, messages, pitches (CRUD part). One resource at a time; after each, verify with the same requests the Rust backend answers, comparing JSON shapes.

**Phase 3 — External services.** `scraper.ts` (Places, incl. background scrape + poll), `pitch.ts` (Groq template/AI batch generation + poll), `whatsapp.ts` (sidecar status/QR proxy).

**Phase 4 — Send queue.** Port `send_queue.rs` semantics exactly: reviewed-only gate re-checked server-side, 20–40 s jitter between sends, status machine `reviewed → queued → sent/failed`, `sent_at` audit stamps, sidecar-down handling. Singleton worker started from `instrumentation.ts`, guarded against dev hot-reload duplication via `globalThis` + atomic DB claims (`UPDATE … WHERE status='queued'` claim pattern). **Manual end-to-end test with a live WhatsApp session before cutover.**

**Phase 5 — Frontend port.** Move pages into `app/` routes (TanStack Router → file-based routing; ~7 pages), port components/hooks/stores nearly verbatim, `api.ts` base URL → same-origin. Keep TanStack Query as-is.

**Phase 6 — Cutover & cleanup.** Update `start.ps1` (sidecar + `next dev` only). Retire `backend/` and `lead-gen-app/` (move to `_legacy/` first, delete after a soak period). Regenerate `CLAUDE.md` and `.ai/*` docs — they will be wrong the moment cutover happens (especially the sqlx sections).

**Phase 7 — Resume product roadmap.** Delivery tracking (project phase 5) and reminders panel (phase 6) resume on the new stack.

## 4. What we gain

- **One language, one repo-half, one process** (plus sidecar). No Rust toolchain, no `cargo` rebuild cycle.
- **The sqlx gotcha disappears.** Prisma migrations don't require applying SQL to the Docker DB before compiling; `prisma migrate dev` handles it, and there's no compile-vs-live-DB coupling.
- **Shared types end-to-end.** Prisma-generated types + zod schemas used by both server and client kill the "mirror models.rs into types/index.ts by hand" chore.
- **Frontend churn is small.** React 19, Tailwind v4, shadcn, TanStack Query, Zustand, RHF+zod all carry over.

## 5. What we lose / top risks (ranked)

1. **The send-queue worker is the migration's crux.** Tokio gives a robust owned worker; in Next.js it's an in-process loop that dies with the server and can be *duplicated* by dev-mode hot reload. Mitigations: `globalThis` singleton guard, atomic claim of queued rows in the DB (safe under duplication), worker re-scans `queued` rows on boot (safe under restart). A regression here risks a **WhatsApp ban** — this phase gets the strictest review.
2. **Loss of compile-time guarantees.** Rust caught type/null/SQL errors at compile time. Mitigation: TS strict, zod validation in every route handler (rule already exists: never trust the frontend), Prisma's generated types.
3. **Long-running background tasks generally** (scrapes, batch Groq generation): same pattern (spawn + poll) works, but Node has no supervisor — an unhandled rejection in a spawned task must be caught and recorded, not allowed to vanish silently.
4. **Prisma baseline on an existing DB** must be done carefully (`migrate resolve`) so Prisma never tries to recreate/reset tables holding real lead data. Backup the DB before Phase 1.
5. **Docs go stale at cutover** — CLAUDE.md/.ai regeneration is a required Phase 6 item, not optional.
6. Minor: `node_modules` + `.next` inside a OneDrive-synced folder causes sync churn/locking; consider excluding those folders from sync.

## 6. Decisions needed before Phase 0

| # | Decision | Recommendation |
|---|---|---|
| 1 | Drop Tauri, run as browser app? | **Yes** — Next.js server can't live inside a static Tauri bundle; re-wrap later if a desktop shell is truly needed |
| 2 | Keep sidecar as separate process? | **Yes** — protects the Baileys session from Next.js restarts/hot reloads |
| 3 | Keep `/api/v1` REST contract (vs Server Actions)? | **Yes** — near-zero frontend churn, side-by-side verification against the Rust backend |
| 4 | Same Postgres DB, baselined? | **Yes** — zero data migration; take a `pg_dump` backup first |

## 7. User Flow & Feature Audit

Done before any porting, by tracing every route in `routes/mod.rs` to its actual caller in the frontend (not just what's defined) — to avoid re-implementing dead code or carrying forward known bugs.

### 7.1 The real flow (confirmed, this is what gets ported)

```
Settings (sender profile, one-time)
Products (what the agency sells: name, price, category)
        │
        ▼
Searches ──create──► run (scrape Google Places) ──► Leads
                                                        │  auto-grouped by contact channel
                                                        │  (has_email / phone_only / no_contact)
                                                        ▼
                                        Leads page → open a Group → GroupPitchDrawer
                                          ├─ generate batch pitches (template merge OR AI/Groq, per-lead)
                                          ├─ review each: edit / regenerate / reject / approve / bulk-approve
                                          └─ Send Group ──► rate-limited send queue ──► WhatsApp (sidecar)
                                                                                              │
                                                                                              ▼
                                                                            Messages page (sent log + follow-ups)
```

Templates (currently mislabeled "Pitches" in the sidebar) is a supporting CRUD screen feeding the "template" pitch mode above — not itself part of the linear flow.

### 7.2 Findings & decisions (approved 2026-07-17)

| # | Finding | Evidence | Decision |
|---|---|---|---|
| 1 | **Dashboard is broken, not just skippable.** "Leads Gathered" stat: `searches?.reduce((acc, _) => acc, 0)` never increments the accumulator — always renders `0`. "Messages This Week" chart plots `count: 1` for every bar regardless of actual date/volume — fabricated, not real data. | `lead-gen-app/src/pages/Dashboard.tsx:30,67` | **Drop entirely.** Not part of the core flow above; nothing else depends on it. |
| 2 | **`recharts` is an unapproved dependency.** CLAUDE.md: "Do not introduce alternative libraries... without explicit approval." `recharts` is used only by Dashboard and nowhere else in the app. | `Dashboard.tsx:2` | Dropping Dashboard also removes the only reason to carry this dependency into `next-app/`. |
| 3 | **`POST /api/v1/messages/send` (`useSendPitch`) is dead code** — defined in `lib/api.ts` / `hooks/useMessages.ts`, never called from any page or component. It also sends a single message outside the group review + rate-limited-queue path, which conflicts with the core rule "all WhatsApp sends go through the rate-limited queue... only reviewed pitches may be sent." | `grep` found zero call sites outside the hook's own definition | **Drop.** Don't port the handler, repo fn, or hook. |
| 4 | **`GET /api/v1/templates/:id/render/:leadId` (`useRenderPitch`) is dead code** — defined, never consumed. | Same grep, zero call sites | **Drop.** Batch generation already renders per-lead server-side; no UI ever needed the single-preview path. |
| 5 | **The sidebar page "Pitches" is actually Template CRUD** (create/edit/delete reusable `{placeholder}` templates, AI-assisted body drafting via Groq, tied to a Product). The *real* pitch review/approve/send flow lives in `GroupPitchDrawer`, opened from the **Leads** page — nothing on the "Pitches" page reviews or sends anything. This is a pure naming collision that makes the flow harder to explain, not a functionality issue. | `pages/Pitches.tsx` body vs. `components/pitches/GroupPitchDrawer.tsx` usage in `pages/Leads.tsx:827` | **Rename the route/sidebar label to "Templates"** in the Next.js rebuild. `GroupPitchDrawer`'s "Pitches" language (review/approve/send) stays as-is — it's already correctly scoped. |

### 7.3 Net effect on the port

- Backend surface to port shrinks by 2 endpoints (`messages/send`, `templates/:id/render/:id`) and their repo functions.
- Frontend surface shrinks by 1 page (`Dashboard.tsx`), 1 route, 1 sidebar entry, 2 dead hooks, and the `recharts` dependency.
- One sidebar label changes: "Pitches" → "Templates" (route path `/pitches` → `/templates`, or keep the path and only change the label — decide at Phase 5 alongside routing).
- Everything else in §2's route/page inventory is confirmed live and ports as planned. No other features identified as droppable — `Dashboard` and the two dead endpoints were the only gap between "what's defined" and "what's actually used."

## 8. Future: Multi-Tenant Architecture (proposed, not started)

> Status: **PROPOSED — discussion only, no code written, not scheduled.** Captured here because it changes the data model and every repo function, so any work on the Next.js app in the meantime should keep this shape in mind (e.g. don't hand-roll a second way of scoping data).

### 8.1 Goal

Today the app is **single-tenant**: one shared workspace, one hardcoded `SenderProfile` row (`PROFILE_ID = "00000000-0000-0000-0000-000000000001"`), no auth, no concept of "whose lead is this." Multi-tenant means many separate users/agencies use the same running app, each seeing only their own Searches, Leads, Products, Templates, Messages, and sender identity — fully isolated from each other.

### 8.2 Data model change

Add a `User` model; give every top-level entity an owner. Child entities (Group, Lead's messages) inherit tenancy transitively through their parent — they don't need their own `userId` column, but every query that reaches them **must** join/filter through the owning chain.

```
User
 ├─ Search[]         (userId FK — new)
 │   ├─ Lead[]        (unchanged — scoped via search.userId)
 │   │   └─ Message[] (unchanged — scoped via lead.search.userId)
 │   └─ Group[]        (unchanged — scoped via search.userId)
 ├─ Product[]         (userId FK — new)
 │   └─ Template[]     (unchanged — scoped via product.userId, or add its own userId if templates can be productless)
 └─ SenderProfile      (userId FK — new; becomes one row per user instead of a singleton)
```

| Model | Change |
|---|---|
| `User` | **New.** Whatever the chosen auth provider needs (see §8.3) plus any profile fields. |
| `Search` | `+ userId String` (FK → User, indexed), `+ user User @relation(...)` |
| `Product` | `+ userId String` (FK → User, indexed) |
| `SenderProfile` | Drop the `PROFILE_ID` singleton constant; `+ userId String @unique` (FK → User) — one profile per user, looked up by session instead of a hardcoded UUID |
| `Lead`, `Group`, `Message`, `Template` | No new column *if* every query into them goes through their parent's `userId` (join-based scoping). Simpler and more consistent to add `userId` directly to `Lead` and `Template` too (denormalized but every `lib/repo` filter becomes a flat `where: { userId }` instead of a nested join) — **recommend this**, it's the same tradeoff Prisma users hit constantly and flat scoping is much harder to get wrong in a `WHERE`-clause review. |

### 8.3 Auth

**Recommendation: Auth.js (NextAuth) v5**, since it's the standard fit for a Next.js App Router project and has first-class Prisma adapter support (`@auth/prisma-adapter`) — it generates the `User`/`Account`/`Session` tables for you instead of hand-rolling them. Session strategy: JWT (simpler, no session table hit per request) unless server-side session revocation is a hard requirement.

Alternative considered: a hosted provider (Clerk, Supabase Auth) — faster to stand up, but adds an external dependency and a second place secrets live; **not recommended** for a tool whose whole pitch is "runs locally, your data stays on your machine" unless that positioning is also changing.

### 8.4 Scoping every query — the actual bulk of the work

Every function in `lib/repo/*.ts` gains a `userId` parameter and a `where: { userId }` (or the equivalent join filter for the non-denormalized models). Every route handler in `app/api/v1/**/route.ts` reads `userId` from the session (`auth()` helper) instead of trusting anything from the request body — **this is a hard security boundary**, not a convenience filter: a route handler that forgets to scope a query is a cross-tenant data leak, not a bug that just shows wrong data to its own user.

Concretely, this touches:
- All 8 `lib/repo/*.ts` files — every exported function.
- All 28 route handlers — add `const userId = await requireUser(req)` (or equivalent) as the first line of every handler body.
- `lib/services/send-queue.ts` — the boot re-scan (`resumeOnBoot`) currently does a global `findMany({ where: { status: "queued" } })`; that's still fine (it's cross-tenant by nature, re-enqueuing everyone's stranded sends), but `processOne` needs no change since it operates on a single message ID already owned by whoever queued it.
- `middleware.ts` (new) — redirect unauthenticated requests to a login page for all `app/**/page.tsx` routes; return 401 JSON for unauthenticated `app/api/**` requests.

### 8.5 The WhatsApp sidecar fork point (the real decision here)

Baileys holds **exactly one linked WhatsApp device per running process** — it's not designed for multi-session. This is the one piece of the migration that doesn't scale by just adding a `userId` column, and it forks the whole effort:

| Option | What it means | Tradeoff |
|---|---|---|
| **A. One shared number** | All tenants send through the same WhatsApp number (the app owner's). No sidecar changes needed. | Simple, ships fast. But tenants' messages are indistinguishable to WhatsApp recipients, replies can't be routed back to the right tenant without extra bookkeeping, and it doesn't fit a real "agency" use case where each tenant wants their own business number. |
| **B. One sidecar process per tenant** | Each user runs (or the app spawns) their own `sidecar/` instance on its own port, holding its own Baileys session. | No sidecar rewrite — reuses today's code as-is. Doesn't scale past a handful of tenants on one machine (each is a full Node process + persistent Baileys socket); process lifecycle management (start/stop/crash-restart per tenant) becomes new infrastructure. |
| **C. Multi-session sidecar** | Rewrite `sidecar/index.js` to hold a map of `userId → Baileys socket`, with per-user QR login and auth-state storage. `lib/services/whatsapp.ts` passes `userId` on every call; sidecar routes to the right session. | The "real" answer for a SaaS-shaped product — scales cleanly. Meaningfully more work: sidecar auth-state persistence (`multiFileAuthState` per user instead of one shared folder), a session-lifecycle API (connect/disconnect/status *per user*), and `lib/services/send-queue.ts` needs a `userId` on every queued message so it calls the right session. |

**Recommendation:** start with **B** if this is still a small-scale/internal multi-tenant need (a handful of agencies, each wanting their own number) — it's a docs+ops change, not a code change, and can graduate to **C** later without touching the Next.js side's `userId`-scoping work, since `lib/services/whatsapp.ts` already isolates the sidecar HTTP client behind one interface. Only build **C** upfront if there's a concrete near-term need for many tenants (double digits+) sharing one deployment.

### 8.6 Phases (draft — sequence to confirm before starting)

1. **Auth** — Auth.js + Prisma adapter, login/logout UI, `middleware.ts` route protection. No data-model changes to existing tables yet; verify login works standalone.
2. **Schema** — add `userId` to `Search`, `Product`, `SenderProfile` (+ `Lead`, `Template` if going with the denormalized recommendation in §8.2). Migration must backfill existing rows to some default/admin user — **this is the one step that touches real data**, back up the DB first (same as the original Rust→Next.js migration's Phase 1).
3. **Repo + route scoping** — mechanical but total: every repo fn + every route handler, per §8.4. Do this resource-by-resource (mirrors the original Phase 2 pattern) so each can be verified in isolation.
4. **Sidecar decision** — implement whichever of Option A/B/C from §8.5 was chosen; this is the phase whose scope is genuinely unknown until that decision is made.
5. **Frontend** — scope UI to "your data only" is automatic once the API is scoped (the frontend never sees other tenants' data), but add account/login UI, a way to switch/view "connected as" for the WhatsApp number, and settings for managing the tenant's own profile.

### 8.7 Open decisions before this can become a real plan

| # | Decision | Recommendation |
|---|---|---|
| 1 | Auth provider | ~~Auth.js v5 + Prisma adapter~~ **Superseded by §9 (decided 2026-07-17): hand-rolled minimal JWT** — user chose simplicity and full visibility over the framework option |
| 2 | `userId` on `Lead`/`Template` directly, or scope via parent join only? | Denormalize (add `userId` directly) — flatter, harder-to-miss `WHERE` filters in review |
| 3 | WhatsApp multi-tenancy: A (shared number) / B (sidecar per tenant) / C (multi-session sidecar) | **B** for now, unless there's a concrete need for many tenants soon |
| 4 | Does "tenant" mean one person, or an agency with a team (multiple logins sharing one workspace)? | Not yet answered — changes §8.2 from `User owns everything` to `Organization owns everything, User belongs to Organization`. **Ask before starting §8.6 phase 1**, since it changes the auth/schema shape, not just an later add-on. |

> **Correction to §8.4/§8.6 (discovered while planning §9):** this project's Next.js version (16) has **deprecated and renamed `middleware.ts` to `proxy.ts`** — same API, new filename and exported function name (`export function proxy(...)`), lives at `src/proxy.ts`. All references to `middleware.ts` above should be read as `proxy.ts`. The Next 16 docs also explicitly warn **not** to rely on the proxy layer alone for auth — every route handler must verify the session itself (defense in depth; a matcher change or refactor can silently remove proxy coverage).

## 9. Authentication Plan — Simple JWT (proposed, not started)

> Status: **PROPOSED — plan only, no code written.** Decisions below were made with the user on 2026-07-17: **signup + login for multiple users** (not a single seeded admin), and a **hand-rolled minimal JWT** (not Auth.js/NextAuth). This is §8.6 Phase 1, specified concretely. Note the scope caveat in §9.7 — auth alone does NOT give data isolation.

### 9.1 What's being built

Email + password signup and login. On successful login, the server signs a JWT and sets it as an **httpOnly, SameSite=Lax cookie** (never localStorage — httpOnly keeps it out of reach of any injected script). Every protected page and API route verifies the token. Logout clears the cookie. That's the whole surface — no OAuth providers, no email verification, no password reset (can be added later; out of scope for "simple").

### 9.2 New dependencies (2)

| Package | Why |
|---|---|
| `jose` | JWT sign/verify. Preferred over `jsonwebtoken` because it works in the proxy runtime and is the modern standard (Auth.js itself uses it). |
| `bcryptjs` | Password hashing. Pure-JS (no native build step on Windows), fine at this scale; swap to `@node-rs/bcrypt` only if login throughput ever matters. |

Plus one new env var in `next-app/.env`: `JWT_SECRET` (long random string; add to `lib/env.ts`'s zod schema). Token expiry: 7 days, sliding is unnecessary for v1.

### 9.3 Schema change (1 new model, no changes to existing tables)

```prisma
model User {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email        String   @unique
  passwordHash String   @map("password_hash")
  name         String?
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@map("users")
}
```

Applied via `npx prisma migrate dev --name add_users` (the first real Prisma-generated migration on top of the `0_init` baseline). **No `userId` columns are added to existing tables in this phase** — that's §8's data-isolation work, deliberately separate (see §9.7).

### 9.4 Files to create / touch

| File | Kind | What |
|---|---|---|
| `src/lib/auth.ts` | new | `hashPassword`/`verifyPassword` (bcryptjs), `signToken(userId)`/`verifyToken(token)` (jose), `AUTH_COOKIE` name constant, `requireUser(req)` helper that reads the cookie → verifies → returns `userId` or throws `AppError` 401 (add an `UNAUTHORIZED` code to `ErrorCode` in `lib/errors.ts`) |
| `src/lib/repo/users.ts` | new | `createUser(email, passwordHash, name)`, `getUserByEmail(email)`, `getUserById(id)` — Prisma-only, matching the existing repo convention |
| `src/lib/schemas.ts` | touch | `signupSchema` (email, password min 8, optional name), `loginSchema` (email, password) |
| `app/api/auth/signup/route.ts` | new | POST: validate → reject duplicate email (generic message — don't leak which emails exist) → hash → create → sign JWT → set cookie → `ok(user)` (without passwordHash). **Note: under `/api/auth/`, not `/api/v1/`** — auth is infrastructure, not a v1 domain resource, and keeping it separate means the proxy matcher can exempt it cleanly. |
| `app/api/auth/login/route.ts` | new | POST: validate → look up → `bcrypt.compare` → sign JWT → set cookie → `ok(user)`. Same generic "invalid credentials" message whether the email is unknown or the password is wrong. |
| `app/api/auth/logout/route.ts` | new | POST: clear the cookie → `ok("logged out")` |
| `app/api/auth/me/route.ts` | new | GET: `requireUser` → return the current user (id, email, name) — lets the client hydrate "who am I" on load |
| `app/login/page.tsx`, `app/signup/page.tsx` | new | RHF + zod forms in the existing UI style; on success redirect to `/`. These two routes render **without** the Sidebar (route-group or conditional layout — decide at implementation). |
| `src/proxy.ts` | new | Next 16 proxy (the renamed middleware): if no valid auth cookie → redirect page requests to `/login`, return 401 JSON envelope for `/api/*` requests. Matcher exempts `/login`, `/signup`, `/api/auth/*`, `_next/*`, favicon. First-line defense only — see §9.5. |
| All 28 `app/api/v1/**/route.ts` | touch | Add `await requireUser(req)` at the top of every handler. Mechanical one-liner per §8.4's rule and Next 16's own guidance (proxy coverage can silently regress; handlers must self-verify). The returned `userId` is **unused** in this phase — it's wired but not yet filtering data (§9.7). |
| `src/hooks/useAuth.ts`, `lib/api.ts` | new/touch | `useMe`, `useLogin`, `useSignup`, `useLogout` hooks + `api.auth.*` methods, following the existing hook/api conventions. Sidebar gains a logout button + current-user display. |
| `lib/errors.ts` | touch | Add `UNAUTHORIZED` (401) to the `ErrorCode` union + an `AppError.unauthorized()` factory. Frontend `request<T>` already throws the envelope; add a global QueryClient `onError` (or a check in `request<T>`) that redirects to `/login` on a 401 so an expired token doesn't strand the UI in error states. |

### 9.5 Request flow

```
Browser ──► src/proxy.ts (Next 16's renamed middleware)
              │  no/invalid cookie?
              │    page request  → 302 /login
              │    /api request  → 401 { success:false, code:"UNAUTHORIZED", ... }
              ▼  valid cookie → request continues
            route handler ──► requireUser(req)   ← verifies AGAIN (defense in depth,
              │                                     required by Next 16 docs — proxy
              ▼                                     coverage can silently regress)
            existing repo/service logic (unchanged in this phase)
```

### 9.6 Order of implementation (when approved)

1. Deps + `JWT_SECRET` + `lib/auth.ts` + `lib/errors.ts` (`UNAUTHORIZED`) — foundations, nothing protected yet.
2. `User` model + migration + `repo/users.ts` + the four `/api/auth/*` routes — verify signup/login/me/logout with plain HTTP calls before any UI exists.
3. `src/proxy.ts` + `requireUser` in all 28 handlers — the app is now actually gated.
4. Login/signup pages + hooks + Sidebar logout + 401→redirect handling — the UX layer.
5. Update `.ai/architecture.md`, `.ai/patterns.md` (new pattern: auth check), `.ai/review-rules.md` (add "every new route handler starts with `requireUser`" to the checklist), `CLAUDE.md` env-var list.

### 9.7 Explicit scope caveat — auth ≠ data isolation

After this plan lands, the app has **login walls but shared data**: every authenticated user still sees the same Searches/Leads/Products/Templates/Messages and the same single `SenderProfile` row, because no `userId` exists on those tables yet. That's §8 Phases 2–3 (schema `userId` columns + scoping all repo fns), deliberately not bundled in here — bundling them would make "simple authentication" into the full multi-tenant migration. Since **signup is open**, anyone who can reach the app and register sees everything — fine while it binds to `localhost`, but this configuration (open signup + shared data) must **not** be exposed beyond localhost. If exposure is the goal, do §8 Phases 2–3 first or disable signup.

## 10. Known Gaps / Hardening Backlog (assessment, not started)

> Status: **ASSESSMENT ONLY — nothing here is implemented or scheduled.** Written 2026-07-17 in answer to "what is still missing that a basic app should have," after the migration was code-complete but before any runtime verification. Ranked by how much each gap is likely to bite. Items already covered by other sections are cross-referenced, not repeated.

### 10.1 Foundational (fix first, in this order)

| # | Gap | Why it matters | Cheapest fix |
|---|---|---|---|
| 1 | **No version control.** The repo is not a git repository — the entire Rust→Next.js migration, all doc rewrites, everything has no history, no diffs, no rollback except OneDrive file recovery. | The single most basic thing any app should have. Every change made so far is unreviewable and unrecoverable if a file is clobbered. | `git init` + `.gitignore` (ensure `next-app/.env`, `backend/.env`, `node_modules`, `.next`, `_backups/` are excluded — **`.env` files currently contain live API keys**) + one initial commit. Minutes of work. |
| 2 | **Never run.** `next-app` has compile-time proof only (`tsc`, `next build`) — no route handler has ever executed against the live DB/Groq/Places/sidecar. | Every other item on this list is secondary to booting it once. Unknown-unknowns live here. | The user's planned verification pass (test order already given: Settings → Products → Searches → Leads → Templates → pitch drawer → Messages → live WhatsApp send **last**). |
| 3 | **Zero tests.** No test runner, no tests, on either the old or new stack. | Not coverage theater — four pure functions carry outsized risk: `renderTemplate` (a bad merge sends broken text to real businesses), `normalisePhone` (a wrong normalization messages a stranger), the auto-group predicates (`lib/repo/groups.ts` BUCKETS), and the send-queue skip/pace logic (regression = ban risk). All are pure/near-pure and cheap to test. | Add vitest + a single spec file for those four units. No E2E harness needed at this stage. |

### 10.2 Safety / trust (a basic app owes users these)

| # | Gap | Why it matters |
|---|---|---|
| 4 | **No confirmation on destructive actions.** Deleting a Search is one click and cascades away all its leads, groups, and message history (`onDelete: Cascade`). Same single-click deletes for products, templates, and groups. No confirm dialog, no undo anywhere. | The most likely way real data is lost by accident. Fix is small: a shared confirm dialog (shadcn `AlertDialog` pattern) wrapped around the four delete mutations. |
| 5 | **Silent mutation failures.** Queries surface errors via TanStack `isError`, but most mutations (delete, rename, approve, move-to-group) have no failure feedback — there is no toast system in the app. A failed delete leaves the row visible with zero explanation. | Users can't distinguish "worked" from "silently failed." Fix: add one toast primitive (e.g. shadcn `sonner`) + `onError` handlers on mutations — but `sonner` is a new dependency, which needs approval per CLAUDE.md. |
| 6 | **Failed sends are dead ends.** A message that lands in `failed` (sidecar down, bad number) has no retry path in the UI — the only recourse is regenerating the pitch from scratch. | Legitimate sends die permanently on transient failures. Fix: a "retry" action that flips `failed → queued` and re-enqueues (must go through the send queue, never a direct send). |
| 7 | **No backup story.** One manual `pg_dump` exists (`_backups/lead_gen_20260717.dump`, taken before the Prisma baseline). Nothing scheduled. | The leads DB is the business asset. Cheapest fix: a dated `pg_dump` line in `start.ps1` so every app start snapshots the DB; rotate/keep the last N. |

### 10.3 Already planned elsewhere (not repeated here)

- **Authentication** — §9 (proposed, not started).
- **Per-user data isolation / multi-tenancy** — §8 (proposed, not started).
- **Delivery + reply tracking, reminders panel** — product roadmap phases 5–6 (`.ai/project.md`). Note this is also why "replied" stats can never populate today: nothing ever sets `delivered`/`replied`, so follow-up logic effectively keys off `sent` only.

### 10.4 Real but deferrable

| Gap | Notes |
|---|---|
| No pagination | Messages page loads every row ever; Leads loads a whole search. Fine for months of single-user local use; becomes a problem at thousands of rows. Defer until felt. |
| Groq rate limits mid-batch | Batch generation loops per-lead with no delay; a free-tier 429 is caught per-item (`warn` + `continue`), so affected leads are **silently skipped** — the user just sees fewer pitches than expected with no explanation. A visible "N failed, retry?" summary would fix the UX; a paced/backoff loop would fix the cause. |
| Logs are ephemeral | `console.*` only — closing the terminal loses the record of what a background batch/scrape did. A tiny file logger (or even append-to-file in the two background loops) would make failed batches debuggable after the fact. |
| Sidecar health visibility | Sidecar-down is only discoverable on the Settings page; on the Leads/pitch-drawer flow a send just fails per-message. A small connection indicator in the Sidebar (reusing the existing 3s `useWhatsAppStatus` poll) would surface it where sending actually happens. |
| Input length bounds | zod schemas validate `min` but almost never `max`; scraped fields are stored unbounded. Low risk locally, but `.ai/review-rules.md` already calls for length-bounding scraped data — the schemas just don't do it yet. |

### 10.5 Suggested order (if/when picked up)

1. `git init` + first commit (§10.1 #1) — before anything else touches the tree.
2. Runtime verification pass (§10.1 #2) — user-driven, already planned.
3. Confirm dialogs + toast feedback (§10.2 #4–5) — small, shared-primitive work, biggest day-to-day trust win.
4. Failed-send retry (§10.2 #6) — touches the send queue, so apply the §5-level review rigor.
5. Vitest + the four pure-function specs (§10.1 #3).
6. Backup line in `start.ps1` (§10.2 #7).
7. Everything in §10.4 as-felt; §8/§9 on their own tracks.
