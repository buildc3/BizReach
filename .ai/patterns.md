# Patterns — The Canonical Way

> **Living document.** After any non-trivial feature, check whether it introduced a new reusable pattern and append it here (the `update-patterns` skill automates the prompt). If a change only reuses what's already documented, skip. Every pattern cites the real file that exemplifies it — when in doubt, open that file and copy its shape.

---

## 1. Add an API endpoint (full stack)

The most common task. Five touches, in order:

1. **Repo fn** — `next-app/src/lib/repo/<resource>.ts`: a Prisma call returning a model (or a small derived shape like `PitchWithLead`).
2. **Route handler** — `next-app/src/app/api/v1/<resource>/[...]/route.ts`: named export (`GET`/`POST`/...) wrapped in `withRoute()`, parses input with a `lib/schemas.ts` zod schema, calls the repo/service fn, returns `ok(data)`.
3. **Client method** — `next-app/src/lib/api.ts`: typed method on the matching `api.<resource>` object using `request<T>`.
4. **Hook** — `next-app/src/hooks/use<Resource>.ts`: `useQuery` or `useMutation` wrapping the client method.
5. (If the frontend has a form for it) **form schema** — `lib/form-schemas.ts`, resolver on a React Hook Form.

Exemplar end-to-end: the pitch review lifecycle — `app/api/v1/pitches/**/route.ts` ↔ `lib/repo/pitches.ts` ↔ `lib/api.ts` `pitches` ↔ `hooks/usePitches.ts`.

## 2. Response envelope + error shape

Every endpoint returns `{ "success": true, "data": … }` on success (via `ok()`, `lib/errors.ts`). Errors return `{ "success": false, "code": "VALIDATION" | "NOT_FOUND" | "SCRAPER" | "WHATSAPP" | "DATABASE" | "INTERNAL", "message": "…" }` — thrown as `AppError` (or a `ZodError`/Prisma error, which `withRoute()`/`errorResponse()` convert automatically). Frontend side, `request<T>` in `lib/api.ts` unwraps `.data` and `throw`s the error JSON on non-OK — components read errors from TanStack Query's `error` state, never `try/catch` around a hook.

```ts
// app/api/v1/products/[id]/route.ts
export const GET = withRoute(async (_req: NextRequest, { params }: Params) => {
  const id = parseUuid((await params).id);
  const product = await repo.getProduct(id); // throws AppError.notFound() if missing
  return ok(product);
});
```

## 3. TanStack Query hook with invalidation

From `hooks/usePitches.ts` (canonical):

```ts
export function useGroupPitches(groupId: string, poll = false) {
  return useQuery({
    queryKey: ["pitches", groupId],
    queryFn: () => api.pitches.listByGroup(groupId),
    enabled: !!groupId,
    refetchInterval: poll ? 1500 : false,
  });
}

function useInvalidatePitches(groupId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["pitches", groupId] });
}

export function useReviewPitch(groupId: string) {
  const invalidate = useInvalidatePitches(groupId);
  return useMutation({ mutationFn: (id: string) => api.pitches.review(id), onSuccess: invalidate });
}
```

Query keys: `["<resource>", scopeId]`. Mutations invalidate the list they affect in `onSuccess`. `enabled: !!id` guards dependent queries.

## 4. Long-running work: fire-and-forget + poll

Never make an HTTP request wait on a scrape or a batch of AI calls. Pattern (`app/api/v1/pitches/generate-batch/route.ts`):

- Handler validates inputs **synchronously** (load template/product up front so bad requests fail immediately),
- then kicks off `void (async () => { ... })()` — an unawaited async IIFE — and returns `ok("started")`,
- inside the loop, per-item failures are `console.warn`'d and the loop `continue`s — one bad lead never kills the batch,
- the frontend polls the list endpoint with `refetchInterval` (pattern 3, `poll = true`) and stops polling when the UI decides it's done.

This works because `next dev`/`next start` is a long-lived process, not a serverless function — the detached async work keeps running after the response is sent. It has no task supervisor (unlike Tokio), so an uncaught rejection inside the IIFE would vanish silently — every per-item operation inside the loop must be wrapped so a single failure can't kill the whole batch.

## 5. WhatsApp sends: the rate-limited queue (mandatory)

All sends go through the singleton worker in `lib/services/send-queue.ts`: it drains message IDs from an in-memory queue and sleeps a jittered 20–40s between sends so the number isn't flagged. To send in bulk:

1. Flip each message's status to `queued` (`repo.setPitchStatus`),
2. `sendQueue.enqueue(id)`.

The worker re-checks status is still `queued` before sending (so cancellation = flip the status), marks `sent` or `failed`, and skips leads without a phone. On server boot, `instrumentation.ts` calls `resumeOnBoot()` to re-enqueue anything left `queued` from a previous crash/restart. **Never call `whatsapp.sendMessage` in a loop yourself.** The queue's `queue`/`running` state lives on `globalThis` specifically so Next.js dev-mode hot-reloads reuse the same worker instead of spawning a duplicate — don't remove that guard. Exemplar: `app/api/v1/pitches/send-group/route.ts`.

## 6. Prisma schema change

1. Edit `next-app/prisma/schema.prisma` (camelCase fields via `@map`, PascalCase model name via `@@map` to the real snake_case table).
2. `npx prisma migrate dev --name <description>` from `next-app/` — applies to the Docker DB and regenerates the client.
3. Update `lib/repo/*.ts` and, if the column is status/enum-like, `lib/schemas.ts` — **Prisma Client does not enforce Postgres `CHECK` constraints**, so any value-set validation has to be re-declared in zod (see the `@@map` comments in `schema.prisma` on `messages`/`products`/`searches` flagging exactly which columns need this).
4. Update `types/index.ts` on the frontend.

Exemplar: the original migration 006/007 CHECK-constrained columns (`messages.status`, `products.category`, `searches.status`) — their zod counterparts live in `lib/schemas.ts`.

## 7. Groq (AI) calls

One pattern, in `lib/services/pitch.ts`: guard `env.GROQ_API_KEY` empty → `AppError.internal(...)`, build a plain-text details block from the entities, `fetch` POST to Groq's OpenAI-compatible chat completions with a `SYSTEM_PROMPT` constant, parse defensively (optional-chain through `choices?.[0]?.message?.content`). Key comes from `lib/env.ts`, sent as Bearer, never logged. New AI features extend this service (or clone its shape into a new `services/` file) — they don't create a second HTTP client convention.

## 8. Sidecar proxying

The frontend never talks to the sidecar. `lib/services/whatsapp.ts` owns the sidecar HTTP client and maps failures to user-actionable `AppError.whatsapp(...)` messages ("Make sure the sidecar is running", "scan the QR code in Settings"); `app/api/v1/whatsapp/*/route.ts` exposes it to the UI. Phone numbers are normalized to digits-only international format by `normalisePhone` (Indian defaults) before sending.

## 9. Template placeholder rendering

`{token}` substitution is case-insensitive and centralized in `renderTemplate` (`lib/repo/pitches.ts`): known tokens (`{business_name}`, `{owner_name}`, `{your_name}`, …) fill from Lead + Search + SenderProfile; unknown tokens stay verbatim so users can see what's unfilled. Don't write a second renderer — extend the `vars` record.

## 10. UI building blocks

- New screen: `app/<route>/page.tsx` (default export, `"use client"`) + Sidebar link in `components/layout/Sidebar.tsx`.
- Feature components under `components/<feature>/` (e.g. `components/pitches/GroupPitchDrawer.tsx` — the exemplar for a drawer-style workflow over a Query hook).
- Loading/error states: `components/layout/Spinner.tsx` and `ErrorState.tsx`, driven by the hook's `isPending`/`isError`.
- Forms: zod schema in `lib/form-schemas.ts` + React Hook Form resolver; submit through a mutation hook; the route handler re-validates via `lib/schemas.ts`.

## 11. `globalThis`-guarded singletons (dev hot-reload safety)

Any module-level singleton that must survive Next.js dev-mode hot module reloads (the Prisma client, the send-queue worker state) follows this shape:

```ts
const globalForX = globalThis as unknown as { x?: X };
export const x = globalForX.x ?? createX();
if (process.env.NODE_ENV !== "production") globalForX.x = x;
```

Without this, every file edit during `next dev` would create a fresh instance while the old one leaks (extra DB connections, a duplicate send-queue worker). Exemplars: `lib/db.ts`, `lib/services/send-queue.ts`.

## 12. Auth gate + per-user data scoping

Every `/api/v1/*` route handler starts with `const userId = await requireUser(req)` (`lib/auth.ts` — reads the `lead_gen_session` httpOnly JWT cookie, throws `AppError.unauthorized()` on missing/invalid/expired). `src/proxy.ts` is a first-line gate (redirects page requests to `/login`, 401s `/api/*` requests) but is **not** the only check — Next 16's own docs warn proxy coverage can silently regress (matcher change, refactor), so every handler must verify again. `/api/auth/*` is exempt from both the gate and this rule (that's the login surface itself).

Every `lib/repo/*.ts` function takes `userId` and scopes its query:

- **Direct owner** (`Search`, `Product`, `Template`, `Lead`, `SenderProfile` — each has a `userId` column): filter `where: { id, userId }` on reads, `updateMany`/`deleteMany` + `count === 0 → AppError.notFound()` on writes (never a bare `update`/`delete`, which would throw a generic Prisma error instead of the app's 404 shape — and would 500 rather than 404 on a cross-tenant ID). Exemplar: `lib/repo/searches.ts`.
- **Child via parent join** (`Group` → `search.userId`, `Message` → `lead.userId` — no own `userId` column, per the deliberate denormalization choice): filter through the relation, e.g. `prisma.group.findFirst({ where: { id, search: { userId } } })`. Exemplar: `lib/repo/groups.ts`'s `getGroup`.
- A cross-tenant ID always reads as `404 NOT_FOUND`, never a `403` — same "don't confirm what exists" convention as login's generic invalid-credentials message.
- **The send-queue worker is the one deliberate exception.** `lib/services/send-queue.ts`'s `processOne` has no request/session context — it only ever acts on a message ID that was already ownership-checked when a route handler enqueued it. It calls unscoped `*Internal` repo fns (`messages.getMessageInternal`, `messages.updateMessageStatusInternal`, `leads.getLeadInternal`) instead of the normal `userId`-scoped ones. Don't add new unscoped repo fns outside this one worker.
- `SenderProfile` moved from a single pre-seeded singleton row to one row per user, lazily created: `getSenderProfile(userId)` is a Prisma `upsert` (create-empty-if-missing), not a `findUnique` that can 404 — the Settings page always expects a row back.

New endpoint checklist addition (extends pattern §1): the repo fn takes `userId` as its scoping param, the route handler resolves it via `requireUser` before anything else.
