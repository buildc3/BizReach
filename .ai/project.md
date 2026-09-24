# Project — Current Initiative

> Snapshot as of 2026-07-17. Correct/update this file as work lands — it's the "what are we in the middle of" context for any AI session.

## Initiative 1 (just completed): Rust/axum + Tauri → Next.js + Prisma migration

The stack was rewritten from three sub-projects (Rust axum backend, React+Tauri frontend, Node sidecar) to two (a single Next.js app owning both frontend and backend, via Prisma; the Node/Baileys sidecar unchanged). Full detail, decision log, and phase-by-phase changelog: **`strategy.md`** and **`progress.md`** at the repo root.

**Status: code-complete (Phases 0–6), builds clean (`tsc --noEmit` + `next build`, 0 errors/warnings), not yet functionally verified against live DB/Gemini/Places/WhatsApp — that verification pass belongs to the user, deliberately not done by the implementing AI session.**

Key outcomes worth knowing before touching this codebase:

- Same live Postgres DB throughout — **no data migration**, Prisma was baselined against the existing schema.
- Four things were dropped/renamed after a feature audit (all approved, see `strategy.md` §7): the broken Dashboard page, two dead API endpoints (`messages/send`, `templates/:id/render/:leadId`), and the "Pitches" page was renamed to "Templates" (it was always template CRUD, not pitch review — the real review UI is `GroupPitchDrawer` on the Leads page).
- The send-queue worker (rate-limited WhatsApp sends) is the highest-risk ported piece — verify it live before trusting it with real bulk sends.
- Legacy `backend/`/`lead-gen-app/` directories may still be on disk (kept deliberately for comparison during verification) — they are dead code, not part of the running app. Check whether they've been removed before assuming they're current.

## Initiative 2 (paused pending Initiative 1's verification): the connected lead-gen flow

Goal: a single flow with **no manual copy-paste**:

Search → scrape Leads → **auto-group** by contact channel → generate per-lead pitches for a group (template merge or AI, one prompt) → review each pitch (edit / regenerate / reject / approve / bulk-approve) → send **reviewed-only** through the rate-limited queue → track delivered + dates → on-screen follow-up reminders.

### Phase status (as of the Rust/Tauri stack, before the migration — functionality was ported as-is, not re-verified)

| Phase | Scope | Status |
|---|---|---|
| 0–1 | Data model (groups, pitch lifecycle statuses), auto-grouping by contact channel | ✅ Done (ported) |
| 2 | Batch pitch generation — two modes (`template` merge / `ai` per-lead via Gemini), background + poll | ✅ Done (ported) |
| 3 | Review UI — `GroupPitchDrawer` on the Leads page; edit/regenerate/reject/approve/bulk-approve | ✅ Done (ported) |
| 4 | Send reviewed-only via rate-limited queue — `lib/services/send-queue.ts` (20–40s jitter) | ✅ Ported — **verify end-to-end with a live WhatsApp session before trusting it (never was, on either stack)** |
| — | Sender profile (signature placeholders, Settings page) | ✅ Done (ported) |
| 5 | **Delivery tracking from the sidecar** — Baileys delivery/read receipts → app → `deliveredAt`/`repliedAt`, statuses `delivered`/`replied`. Sidecar still has no receipt/webhook path; `messages` stop at `sent`/`failed`. | ⬜ Next (unchanged by migration) |
| 6 | **Reminders panel** — surface follow-ups in the UI. `GET /api/v1/messages/followups?older_than_days=N` + `api.messages.followups()` exist; no page/panel consumes them yet. | ⬜ Remaining (unchanged by migration) |

## Standing design decisions (confirmed earlier — don't re-litigate)

- Grouping is **auto by contact channel** (`has_email`, `phone_only`, `no_contact`); users can move/rename/merge; user-created groups get `kind='manual'`.
- Pitch personalization is **per-lead** — every pitch unique in AI mode.
- A pitch **is** a `messages` row walking the status machine `draft → reviewed/rejected → queued → sent → delivered → replied/failed`.
- Only `reviewed` pitches may be sent; sending always goes through the send queue.
- Recommended but not built: Campaign as a first-class entity; auto follow-up as one-click confirm.

## Operational reminders

- After any `next-app` code change: hot reload usually handles it; restart `next dev` if behavior looks stale, and always restart after an `instrumentation.ts` change (it only runs `register()` once per server start).
- Schema changes go through `npx prisma migrate dev --name ...` from `next-app/` — see `.ai/patterns.md` §6.
- Start the full stack with `./start.ps1` (sidecar + `next-app` only, since the migration).
