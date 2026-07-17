# Review Rules — Checklists

Run these before calling any change done. They're weighted to this app's actual risks: getting the WhatsApp number banned, corrupting the pitch lifecycle, and duplicate in-process singletons under Next.js dev hot-reload — not a generic OWASP list.

---

## Code checklist

- [ ] Follows an existing pattern from `.ai/patterns.md` (or flags why a new one is needed).
- [ ] `tsc --noEmit` and `next build` (from `next-app/`) are both clean — 0 errors, 0 warnings.
- [ ] All five endpoint touches present and consistent: repo → route handler → `api.ts` → hook (+ form schema if applicable) (patterns §1).
- [ ] Prisma schema field additions/renames are mirrored in `types/index.ts` (camelCase) and, if status/enum-like, validated in `lib/schemas.ts` (Prisma doesn't enforce DB `CHECK` constraints).
- [ ] Errors are typed `AppError` (or a ZodError/Prisma error left to propagate through `withRoute()`); frontend reads them from Query `error` state — no silent `catch {}` swallowing an error into nothing.
- [ ] Fire-and-forget background work (`void (async () => {...})()`) tolerates per-item failure (`console.warn` + `continue`), never lets one bad item kill the whole batch — there's no task supervisor like Tokio here.
- [ ] Any new module-level singleton uses the `globalThis` guard pattern (patterns §11) — a naive singleton duplicates on every `next dev` hot-reload.
- [ ] No new npm dependency without a stated reason.

## WhatsApp-safety checklist (highest-stakes area)

- [ ] Every send path goes through the queue — grep for direct `whatsapp.sendMessage`/`sendMessage(` calls; the only legitimate caller is `lib/services/send-queue.ts`'s `processOne`.
- [ ] Nothing shrinks or bypasses the 20–40s jittered pacing, and no parallel second worker is introduced (check the `globalThis` guard is intact).
- [ ] Only `reviewed` pitches can become `queued`; the worker re-checks `status === "queued"` before sending (cancellation safety).
- [ ] Phone numbers pass through `normalisePhone`; leads without a phone are marked `failed`/skipped, never sent blind.
- [ ] Sidecar-down and not-connected cases produce actionable `AppError.whatsapp(...)` messages, not unhandled rejections or hangs.
- [ ] `instrumentation.ts`'s boot re-scan (`resumeOnBoot`) isn't accidentally re-triggered per-request — it must only run once per server start.

## Pitch-lifecycle integrity

- [ ] Status transitions respect the machine: `draft → reviewed | rejected`, `reviewed → queued → sent → delivered → replied | failed`. No handler writes an arbitrary status string outside this set (the DB `CHECK` constraint still exists from the original migrations — Prisma just doesn't validate it client-side, so the app-level check in `lib/schemas.ts`/route handlers is now the only enforcement before the DB rejects it).
- [ ] Timestamps track transitions (`reviewedAt`, `sentAt`, `deliveredAt`, `repliedAt`) — a status change without its timestamp is a bug.
- [ ] Duplicate-run behavior is defined: re-generating a group's pitches replaces only un-reviewed drafts; re-sending a group must not double-enqueue already-`queued`/`sent` messages.

## Security checklist (local-first threat model)

- [ ] No secrets in code, logs, or commits — keys live in `next-app/.env` and are read only via `lib/env.ts`. Grep the diff for key-looking literals.
- [ ] Every route handler validates its own input (IDs are valid UUIDs via `parseUuid`, enums whitelisted, bodies non-empty via `lib/schemas.ts`) — the client's `lib/form-schemas.ts` validation counts for nothing server-side.
- [ ] Prisma calls only, no raw/string-concatenated SQL, except the deliberate raw scan in `send-queue.ts`'s `resumeOnBoot` (a `findMany`, not raw SQL — flag if this ever needs to become raw SQL).
- [ ] Rendered template/AI output is treated as plain text in the UI (no `dangerouslySetInnerHTML` — currently zero uses; keep it that way).
- [ ] The open-CORS-equivalent, no-auth setup (same-origin Next.js app) is acceptable **only** while it binds to `localhost`. Any change that exposes the app beyond localhost must add auth first — stop and flag it.
- [ ] Scraped data is untrusted input: length-bound and sanity-check fields before storing/rendering.

## Production/runtime checklist

- [ ] Prisma migrations are generated via `prisma migrate dev` (not hand-written raw SQL) so the migration history stays consistent — the one exception is the `0_init` baseline, which intentionally matches the pre-existing DB and must never be re-run destructively.
- [ ] Restart story stated: does this change need a `next dev`/`next start` restart, sidecar restart, or both? (Most route-handler changes hot-reload; `instrumentation.ts` changes need a full restart to re-run `register()`.)
- [ ] External calls (Groq, Places, sidecar) handle timeout/non-200/malformed-JSON without crashing the fire-and-forget task or leaving rows stuck in a transient status.
- [ ] Concurrency: user actions racing a background task (e.g. rejecting a pitch while the queue drains) resolve safely via status re-checks.
- [ ] Enough `console.info`/`console.warn`/`console.error` on new lifecycle events to debug a failed batch from logs alone, without logging message bodies or PII more than existing code does.
