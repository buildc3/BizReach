---
name: update-patterns
description: PROACTIVE — run after implementing and reviewing any non-trivial change. Checks whether the change introduced a new reusable pattern, proposes an addition to .ai/patterns.md, and waits for user approval before writing. Skips silently if nothing new.
---

# Update Patterns

Keep `.ai/patterns.md` a living document. This skill is the last step of the required workflow in `CLAUDE.md` — run it after implementation + review of any non-trivial change (skip for typo fixes, doc edits, pure refactors that reuse existing shapes).

## Steps

1. **Re-read `.ai/patterns.md`** to know what's already documented.
2. **Look at the change just implemented** and ask: does it contain a *reusable* approach a future task would want to copy? Signals:
   - a new kind of endpoint shape, background job, or worker
   - a new integration (external API, sidecar behavior, AI usage)
   - a new UI workflow (drawer/wizard/polling pattern, new form approach)
   - a new migration/data-lifecycle technique
   - the first instance of anything likely to be done twice
3. **If it only reuses documented patterns: stop silently.** Do not announce that no update is needed — just finish.
4. **If there's a genuinely new pattern**, draft the addition in the established format of `.ai/patterns.md`:
   - a numbered `##` section with a short imperative name
   - 3–8 lines: when to use it, the shape, and the **exemplar file path** from the change just made
   - a code snippet only if the shape isn't obvious from prose
5. **Show the draft to the user and ask for approval.** Do not write to `.ai/patterns.md` until they approve. Apply any edits they request.
6. On approval, append the section to `.ai/patterns.md` (keep numbering consecutive) and confirm in one line.

## Rules

- One pattern per proposal; if a change spawned two, propose them separately.
- Never rewrite or renumber existing patterns here — only append. Corrections to existing patterns are their own user-approved task.
- The bar is "would a future task copy this?", not "is this code new?". When unsure, propose it — the user decides.
