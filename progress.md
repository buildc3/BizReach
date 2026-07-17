# Migration Progress — Rust/axum + Tauri → Next.js + Prisma

> Companion to `strategy.md`. Update as phases land. Statuses: ⬜ Not started · 🟡 In progress · ✅ Done · ⛔ Blocked

## Current state

- **Overall status:** Phases 0–6 code-complete. `next-app/` builds clean (`next build`, 0 warnings, 0 type errors) with all 28 API routes and 6 pages generated. **Not yet functionally verified against a live run** (DB reads/writes, Groq, Places, WhatsApp send) — user is verifying end-to-end.
- `start.ps1` now launches the 2-service stack (sidecar + `next-app`). Legacy `backend/` and `lead-gen-app/` are left on disk untouched (not started by `start.ps1`, not deleted) so they remain available for side-by-side comparison during verification. No DB migration was performed — `next-app` reads/writes the same live `lead_gen` database the Rust backend used.

## Decisions log

| Date | Decision | Status |
|---|---|---|
| 2026-07-17 | Drop Tauri, run as localhost browser app | ✅ Approved |
| 2026-07-17 | Keep Baileys sidecar as separate process | ✅ Approved |
| 2026-07-17 | Preserve `/api/v1` REST contract + envelope | ✅ Approved |
| 2026-07-17 | Reuse existing Postgres DB, Prisma baseline (no data migration) | ✅ Approved |
| 2026-07-17 | Drop Dashboard page entirely (broken stats + fake chart data, unapproved `recharts` dep) | ✅ Approved — strategy.md §7.2 #1–2 |
| 2026-07-17 | Drop dead endpoint `POST /messages/send` + `useSendPitch` (unused, bypasses send-queue rule) | ✅ Approved — strategy.md §7.2 #3 |
| 2026-07-17 | Drop dead endpoint `GET /templates/:id/render/:leadId` + `useRenderPitch` (unused) | ✅ Approved — strategy.md §7.2 #4 |
| 2026-07-17 | Rename sidebar "Pitches" page → "Templates" (it's template CRUD, not pitch review) | ✅ Approved — strategy.md §7.2 #5 |

**Environment confirmed (2026-07-17):** Node v20.19.0, npm 11.8.0, Docker `postgres-client` running, `DATABASE_URL=postgres://yashdba:123456@localhost:5432/lead_gen`.

## Phase tracker

| Phase | Scope | Status | Notes |
|---|---|---|---|
| 0 | Scaffold `next-app/`, deps, `.env` → existing DB | ✅ | Next 16.2.10, Prisma 7.8.0 (+ `@prisma/adapter-pg` driver adapter, required in Prisma 7), TanStack Query, Zustand, RHF, zod, shadcn deps. `lib/db.ts` singleton done. |
| 1 | Data layer — Prisma introspect + baseline, `db.ts`/`env.ts`/`errors.ts` | ✅ | DB backed up (`_backups/lead_gen_20260717.dump`) before touching anything. `prisma db pull` → cleaned schema (camelCase `@map`, PascalCase models) → baselined via `migrate resolve --applied` (no DDL executed, existing tables untouched). `lib/env.ts`, `lib/errors.ts` (`AppError` + `{success,code,message}` envelope), `lib/schemas.ts` (zod, since DB CHECK constraints aren't enforced by Prisma Client) all done. |
| 2 | CRUD resources — settings, products, templates, searches, leads, groups, messages, pitches | ✅ | All 8 resources in `lib/repo/*.ts`, Prisma-only. `messages`/`pitches` exclude the 2 dropped endpoints. |
| 3 | External services — scraper (Places), pitch (Groq), whatsapp (sidecar proxy) | ✅ | `lib/services/{scraper,pitch,whatsapp}.ts`. Email scraping uses a regex `mailto:` extraction instead of the Rust `scraper` crate (no new HTML-parsing dependency). |
| 4 | Send queue — in-process worker, jitter, reviewed-only gate, audit stamps | ✅ (code) | `lib/services/send-queue.ts`: `globalThis`-guarded singleton (safe under dev hot-reload), 20–40s jitter, re-scans `queued` rows on boot via `instrumentation.ts` → `resumeOnBoot()` (Rust version had no boot re-scan; added since strategy.md §5 committed to it). **Not yet live-tested against real WhatsApp — do this before trusting it with real sends.** |
| 5 | Frontend port — pages→App Router, components/hooks/stores, api.ts base URL | ✅ | All pages/components/hooks/stores ported. No Dashboard page/route. "Pitches" page ported as "Templates" (`/templates`, label + route rename). `lib/schemas.ts` (client form schemas) renamed to `lib/form-schemas.ts` to avoid colliding with the new server-side `lib/schemas.ts`. Settings page drops the "Backend Connection" (`apiUrl`) card — structurally meaningless now that the API is same-origin. |
| 6 | Cutover — start.ps1, retire legacy to `_legacy/`, regenerate CLAUDE.md/.ai | 🟡 | `start.ps1` now launches sidecar + `next-app` only. `CLAUDE.md` and all 6 `.ai/*.md` docs rewritten for the new stack (architecture, coding-standards, patterns, review-rules, design, glossary, project). **Deliberately not done:** moving `backend/`/`lead-gen-app/` to `_legacy/` — left in place on purpose so the old stack is immediately available if something surfaces during the first real run that `tsc`/`next build` didn't catch. Do this only after the user confirms `next-app` actually works. |
| 7 | Resume roadmap — delivery tracking, reminders panel | ⬜ | Product phases 5–6, unstarted — same scope as before the migration |

## Resource port checklist (Phase 2 detail)

| Resource | Repo (Prisma) | Route handler | Verified vs Rust |
|---|---|---|---|
| settings / profile | ✅ | ✅ | ⬜ *(pending user verification)* |
| products | ✅ | ✅ | ⬜ |
| templates | ✅ | ✅ | ⬜ |
| searches | ✅ | ✅ | ⬜ |
| leads | ✅ | ✅ | ⬜ |
| groups | ✅ | ✅ | ⬜ |
| messages | ✅ | ✅ | ⬜ *(excludes dropped `POST /messages/send`)* |
| pitches | ✅ | ✅ | ⬜ *(excludes dropped `GET /templates/:id/render/:leadId`)* |

`tsc --noEmit` and `next build` both pass clean (0 errors, 0 warnings) — this confirms the code compiles and every route/page is wired up, **not** that it behaves correctly against live data/services. "Verified vs Rust" (actually exercising each endpoint and comparing JSON/behavior) is explicitly left to the user's own pass, per their instruction.

## Open questions / blockers

- **Send queue is unverified against real WhatsApp.** This is the highest-risk piece (ban risk on misbehavior) — strongly recommend a live E2E test before real bulk sends, per strategy.md §5.
- `backend/` and `lead-gen-app/` (the old Rust/Tauri stack) are still on disk, untouched, not started by `start.ps1`. Left in place intentionally — move to `_legacy/` (or delete) only after confirming `next-app` works.
- `next-app/` has never been run (`npm run dev`) or exercised against the live sidecar/Groq/Places APIs by me — only `next build` (which doesn't execute route handlers) and `tsc`.

## Changelog

- **2026-07-17** — Created `strategy.md` and `progress.md`. No code changes.
- **2026-07-17** — Phase 0: scaffolded `next-app/` (Next 16.2.10, TS strict, Tailwind v4, App Router, src dir), installed Prisma 7.8.0 + TanStack Query + Zustand + RHF + zod + shadcn deps, `prisma init`, wrote `.env` pointing at the existing `lead_gen` DB, verified connectivity (`prisma db execute`) and client generation. Noted Prisma 7 requires a driver adapter (`@prisma/adapter-pg`) — installed.
- **2026-07-17** — Feature audit (strategy.md §7) before continuing Phase 0/1: traced every backend route to its actual frontend caller. Found Dashboard is broken (dead stat, fake chart data) and depends on an unapproved library; found 2 dead endpoints; found the "Pitches" page is mislabeled Template CRUD. All four flagged for removal/rename — approved by user.
- **2026-07-17** — User instructed: proceed through the full migration without pausing for functional verification at each step; they will verify everything themselves at the end. Executed Phases 1–6 in one continuous pass:
  - Backed up `lead_gen` DB (`pg_dump` custom format) before any Prisma schema work.
  - Phase 1: introspected + cleaned `schema.prisma` (7 models, camelCase mapping), baselined against the live DB with `prisma migrate resolve` (no DDL run), wrote `lib/{db,env,errors,schemas}.ts`.
  - Phase 2: ported all 8 resources to `lib/repo/*.ts` (Prisma-only, no route-handler SQL).
  - Phase 3: ported `lib/services/{scraper,pitch,whatsapp}.ts`.
  - Phase 4: ported the send queue as `lib/services/send-queue.ts` + `instrumentation.ts`, added boot re-scan of stranded `queued` rows (documented mitigation from strategy.md §5, not present in the Rust original).
  - Wrote all 28 `app/api/v1/**/route.ts` handlers (Next 16 async `params`, confirmed via the bundled Next docs since this version has breaking changes vs. training data).
  - Phase 5: ported all pages/components/hooks/stores; renamed "Pitches" → "Templates"; dropped the Dashboard route; renamed client-side `lib/schemas.ts` → `lib/form-schemas.ts` to avoid colliding with the new server-side validation module of the same original name; dropped the now-meaningless "Backend Connection" settings card (same-origin API has no configurable URL).
  - Phase 6 (partial): updated `start.ps1` to launch sidecar + `next-app` only. Did **not** move/delete `backend/`/`lead-gen-app/` or touch `CLAUDE.md`/`.ai/*` — left for after user verification.
  - Verified `tsc --noEmit` and `next build` both pass with zero errors/warnings (one CSS `@import`-order warning found and fixed by switching Google Fonts loading from a CSS `@import` to `next/font/google`, the idiomatic Next.js approach). **No functional/runtime verification performed** — per instruction, that's the user's pass.
- **2026-07-17** — User said "proceed" after the completion summary above. Continued with the remaining non-destructive Phase 6 documentation work (regenerating docs is a migration deliverable, not "functional validation," so it stayed in scope of "just migrate the stack"):
  - Rewrote root `CLAUDE.md` for the 2-service Next.js + Prisma stack (tech stack table, Prisma/Next workflow replacing the old sqlx-gotcha section, core rules updated to the new file layout).
  - Rewrote all 6 `.ai/*.md` docs: `architecture.md` (full new folder tree + layer rules), `coding-standards.md` (TS/Next.js conventions, client/server boundary rule, the two-zod-files distinction), `patterns.md` (11 patterns incl. new ones: `globalThis` singleton guard, fire-and-forget+poll without a task supervisor), `review-rules.md` (checklists re-weighted to Next.js risks: dev-hot-reload singleton duplication replaces the old sqlx-compile risk), `design.md` (path updates + documented why fonts moved from CSS `@import` to `next/font/google`; noted Recharts/Dashboard are gone), `glossary.md` (Prisma camelCase field tables, flagged the two renamed/dropped items so stale context doesn't reference them).
  - **Deliberately did not** move `backend/`/`lead-gen-app/` to `_legacy/` — flagged as a judgment call: since `next-app` has never actually been run (`npm run dev`) or exercised against live services, moving the fallback stack away before the user's first real run seemed premature. Left both directories in place, untouched, for that reason. This is the one remaining Phase 6 item, and it's the user's call when to do it.
- **2026-07-17** — Post-migration flow review: asked what's "not useful at all" in the ported flow. Flagged the single-lead "Generate AI Pitch" dialog on the Leads page (`GeneratePitchDialog` — per-row Sparkles button, copy-to-clipboard only) as contradicting the app's own stated goal in `.ai/project.md` ("no manual copy-paste") — it generated text with no way to save/send it, duplicating what `GroupPitchDrawer`'s regenerate action already does inside the real reviewed→queued→sent pipeline. User agreed; removed it from `next-app/src/app/leads/page.tsx` along with its now-dead imports (`Copy`, `Check`, `Dialog*`, `Label`, `Textarea`, `useGeneratePitch`, `useProducts` — none used elsewhere in that file). `useGeneratePitch`, `hooks/usePitch.ts`, and `POST /api/v1/pitches/generate` were **not** removed — `GroupPitchDrawer`'s own regenerate button still depends on all three. `tsc --noEmit` and `next build` both re-verified clean after the change.
