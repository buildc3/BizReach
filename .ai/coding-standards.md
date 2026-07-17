# Coding Standards

Conventions as actually configured in this repo. There is deliberately **no ESLint config beyond `eslint-config-next`'s default and no Prettier config** — standards below come from the default toolchain plus the style already established in the code. Don't add lint tooling without approval; match the file you're editing.

---

## TypeScript / Next.js (next-app/)

**Toolchain:** `tsc --noEmit` and `next build` are both clean-required (0 errors). `next.config.ts` + `tsconfig.json` are the scaffold defaults (`strict: true`, path alias `@/*` → `./src/*`). No `noUnusedLocals`/`noUnusedParameters` enforced by the compiler, but keep the codebase as if they were — this app came from a Rust/TS codebase that had zero dead code, don't regress that.

- **Imports:** always the `@/` alias (`@/lib/api`, `@/components/ui/button`), never relative `../../`. Type-only imports use `import type`.
- **Route handlers** (`app/api/v1/**/route.ts`): named exports `GET`/`POST`/`PUT`/`DELETE` wrapped in `withRoute()` (`lib/errors.ts`). Dynamic segment params are a `Promise` in this Next.js version — always `const { id } = await params`, never destructure synchronously (this app targets Next 16; check `node_modules/next/dist/docs/` before assuming an older API shape if something doesn't typecheck).
- **Exports:** named exports for hooks, components, and utilities. Page components (`app/**/page.tsx`) default-export — that's a Next.js file convention, not a style choice.
- **Naming:** `PascalCase.tsx` components; hooks `use<Resource>.ts` exporting `use<Thing>` fns; Zustand stores `use<Name>Store.ts` in `stores/`; camelCase for everything JSON (matches the Prisma schema's `@map`'d field names).
- **Hooks own all server I/O.** One hook file per resource wrapping `api.<resource>.*` in `useQuery`/`useMutation`, with query keys like `["pitches", groupId]` and invalidation `onSuccess` (see `hooks/usePitches.ts` — the canonical example).
- **Two zod schema files, don't confuse them:** `lib/schemas.ts` (server, route-handler input validation — the actual trust boundary) vs. `lib/form-schemas.ts` (client, React Hook Form resolvers — UX only, never trusted). A route handler must never skip `lib/schemas.ts` validation just because the form already validated with `lib/form-schemas.ts`.
- **Errors:** route handlers throw `AppError` (`lib/errors.ts`) for expected failures (`AppError.validation(...)`, `AppError.notFound(...)`, etc.) or let a thrown `ZodError`/Prisma error propagate — `withRoute()` converts all three into the `{ success: false, code, message }` envelope. Don't hand-roll `try/catch` + `NextResponse.json` in a route file; use the wrapper.
- **Prisma calls only in `lib/repo/*.ts`.** Route handlers and services never import `lib/db.ts` directly.
- **Types:** every Prisma model has a camelCase mirror in `types/index.ts` for client use. `any` is not used anywhere in the codebase — keep it that way.
- **Forms:** React Hook Form + zod resolver, schemas in `lib/form-schemas.ts`. The route handler still re-validates via `lib/schemas.ts`.
- **Styling:** Tailwind utilities inline, merged with `cn()` from `lib/utils.ts` when conditional. No CSS modules, no styled-components; the only stylesheet is `app/globals.css` (tokens + base). Use semantic token classes (`bg-background`, `text-muted-foreground`, `border-border`) — see `.ai/design.md`.
- shadcn/ui primitives are copy-in files under `components/ui/`, each starting with `"use client"` — edit them there if a variant is needed.
- **Client/server boundary:** any component using hooks (`useState`, TanStack Query, Zustand) needs `"use client"` at the top of the file. Nearly every page and component in this app is a Client Component — this is a client-heavy app by design (ported from a pure-SPA architecture), not a mistake. Route handlers and `lib/repo`/`lib/services` files are server-only and must never be imported from a `"use client"` file.

## Node sidecar (sidecar/)

- Plain JavaScript, ESM (`"type": "module"`), single file `index.js`. No TypeScript, no framework beyond Express, no build step for dev (`node index.js`).
- Keep it minimal: it exists only to bridge HTTP ↔ Baileys. New behavior almost always belongs in `next-app/src/lib/services/` instead — adding an endpoint here needs a stated reason.
- Logging via `pino` (already a dependency).

## All parts

- Match the surrounding file's idiom, comment density, and naming before any personal preference.
- Comments explain constraints and *why*, not what the next line does.
- Small, focused diffs. No drive-by refactors mixed into feature changes.
- New dependencies (npm) require a stated reason at plan time.
