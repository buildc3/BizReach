# GitHub Copilot Instructions

This repository's AI guidance lives in shared docs so every assistant (Copilot, Claude, etc.) works from the same context. **Read these files before generating or changing code:**

- [`CLAUDE.md`](../claude.md) — project identity, the actual tech stack (axum + Postgres backend, React 19 + Tauri-shell frontend, Baileys sidecar), the sqlx migration gotcha, and the required plan-then-approve workflow. Despite the filename, it applies to all AI assistants.
- [`.ai/architecture.md`](../.ai/architecture.md) — folder tree, layer rules, where new code goes
- [`.ai/coding-standards.md`](../.ai/coding-standards.md) — Rust + TypeScript conventions as actually configured (note: `tsc` strict is the only JS linter; default rustfmt/clippy)
- [`.ai/patterns.md`](../.ai/patterns.md) — the canonical way to do common tasks, with real file references
- [`.ai/review-rules.md`](../.ai/review-rules.md) — checklists to run before considering a change done
- [`.ai/glossary.md`](../.ai/glossary.md) — domain entities (Search, Lead, Group, Product, Template, Message/Pitch, SenderProfile) with real fields
- [`.ai/design.md`](../.ai/design.md) — design tokens and UI conventions
- [`.ai/project.md`](../.ai/project.md) — the current in-flight initiative and phase status

Key rules that always apply:

- Business logic lives in the Rust backend; React only renders and calls typed hooks.
- All WhatsApp sends go through the rate-limited `SendQueue` — never loop-and-send.
- Validate every input inside axum handlers; frontend Zod validation counts for nothing.
- DB changes go through idempotent migrations, applied to the Docker DB **before** compiling (sqlx macros check queries against the live DB).
- No new dependencies or alternative libraries without explicit approval.

## Standing instruction: keep patterns.md alive

After implementing any non-trivial feature or change, check whether it introduced a **new reusable pattern** (a new kind of endpoint, background job, UI workflow, integration, etc.). If it did, propose an addition to [`.ai/patterns.md`](../.ai/patterns.md) — a short named section with the exemplar file path — and ask the user to approve it before writing. If the change only reused already-documented patterns, skip silently. (Claude Code automates this via the `update-patterns` skill; Copilot must do it as part of finishing any task.)
