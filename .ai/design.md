# Design — Tokens & UI Conventions

The app's design system ("Kinetic Utility") is defined **entirely** in `next-app/src/app/globals.css` via Tailwind v4's CSS-first `@theme` block. There is no `tailwind.config.js` — new tokens go in the `@theme` block, dark overrides in the `.dark` selector. Values below are the actual current tokens; when they disagree with this doc, `globals.css` wins.

---

## Color tokens (semantic, shadcn-mapped)

Use these through Tailwind utility classes (`bg-background`, `text-foreground`, `bg-primary`, `border-border`, `text-muted-foreground`, …) — never raw hex in components.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--color-background` | `#f8f9fa` | `#1a1c1e` | app surface |
| `--color-foreground` | `#191c1d` | `#f0f1f2` | primary text |
| `--color-card` | `#ffffff` | `#2e3132` | cards / panels |
| `--color-primary` | `#004ac6` (Corporate Blue) | `#b4c5ff` | actions, focus, brand |
| `--color-primary-foreground` | `#ffffff` | `#00174b` | text on primary |
| `--color-secondary` / `-foreground` | `#d5e3fc` / `#57657a` | `#3a485b` / `#d5e3fc` | secondary containers |
| `--color-muted` / `-foreground` | `#edeeef` / `#434655` | `#3a3c3e` / `#c3c6d7` | subdued surfaces / secondary text |
| `--color-accent` / `-foreground` | `#e7e8e9` / `#191c1d` | `#404244` / `#f0f1f2` | hover states |
| `--color-destructive` | `#ba1a1a` | (light value) | delete/danger |
| `--color-border` / `--color-input` | `#c3c6d7` | `#434655` | borders, input outlines |
| `--color-ring` | `#004ac6` | `#b4c5ff` | focus rings |

Extended scales (light-mode, defined in `@theme`):

- **Surface elevation:** `surface-dim #d9dadb` → `surface-container-lowest #ffffff` / `-low #f3f4f5` / `container #edeeef` / `-high #e7e8e9` / `-highest #e1e3e4`; outlines `outline #737686`, `outline-variant #c3c6d7`.
- **Primary tones:** `primary-container #2563eb`, `on-primary-container #eeefff`, `inverse-primary #b4c5ff`.
- **Tertiary/warning (orange):** `tertiary #943700`, `tertiary-container #bc4800`, `on-tertiary-container #ffede6`.
- **Error containers:** `error-container #ffdad6`, `on-error-container #93000a`.

Dark mode = class strategy: `.dark` on the root overrides the semantic tokens. When adding a token, add its `.dark` override too (extended-scale tokens currently have light values only — follow suit unless dark support is being added deliberately).

## Typography

- Sans: **Inter** (400/500/600/700) — the default body font; loaded via `next/font/google` in `app/layout.tsx` (`--font-inter` CSS variable), **not** a CSS `@import` — Tailwind v4's `@import "tailwindcss"` must be the first rule in the stylesheet, and a Google Fonts `@import` after it breaks CSS's import-ordering rule during the production build. `next/font` also self-hosts the font (no external request, better perf) — don't reintroduce a CSS `@import` for fonts.
- Mono: **JetBrains Mono** (400) via `.font-mono`, same `next/font` pattern (`--font-jetbrains-mono`) — used for identifiers and table data (phone numbers, IDs).
- No custom type-scale tokens: use Tailwind's default `text-*` utilities, matching sizes already used in sibling components.

## Spacing, radius, chrome

- **Radius:** `--radius: 0.25rem` — a deliberate **4px base grid**, sharper than shadcn's default. Use `rounded` / `rounded-md` per existing components; don't introduce large radii.
- **Spacing:** Tailwind defaults; copy the density of the page you're editing.
- **Scrollbars:** custom thin (5px) webkit scrollbar, thumb `#c3c6d7` → hover `#737686`, defined globally in `globals.css`.
- Global base: every element inherits `border-color: var(--color-border)`; body gets background/foreground/font from tokens.

## Component conventions (shadcn/ui)

**default** style, `cssVariables: true`, base color neutral, aliases `@/components`, `@/components/ui`, `@/lib`, `@/hooks`.

- Primitives live in `src/components/ui/` (currently: button, card, dialog, input, label, textarea) — copy-in code, each file starting with `"use client"`, edit variants in place using `class-variance-authority`.
- Compose with `cn()` (`clsx` + `tailwind-merge`) from `@/lib/utils` for conditional classes.
- Icons: **lucide-react** only. No charting library is currently used — the old Dashboard page (the only consumer of Recharts) was dropped during the Next.js migration for being broken and unused elsewhere; don't reintroduce Recharts without a stated reason and updating this doc.
- Layout chrome (Sidebar, TopBar) and shared states (Spinner, ErrorState) live in `src/components/layout/` — reuse them rather than rolling per-page loaders.
- Feature-specific composites go in `src/components/<feature>/` (exemplar: `components/pitches/GroupPitchDrawer.tsx`).
