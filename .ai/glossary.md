# Glossary — Business Entities & Domain Terms

Shared vocabulary. Fields below are the **real** ones from `next-app/prisma/schema.prisma` (DB snake_case via `@map`; Prisma Client / JSON / TS all camelCase). Use these names consistently in code, DB, UI, and conversation.

---

## Search

One scraping job: "find `bizType` businesses in `area`". Running it scrapes leads (Google Places) and auto-groups them.

| Field | Type | Notes |
|---|---|---|
| id | string (uuid) | |
| name | string | user-facing label |
| bizType | string | business category queried (also feeds `{business_type}` placeholder) |
| area | string | location queried |
| status | string | `pending \| running \| done \| error` — DB `CHECK`-constrained, re-validated in `lib/schemas.ts` since Prisma Client doesn't enforce it |
| createdAt | DateTime | |

## Lead

A scraped business — the central entity. Belongs to one Search, optionally to one Group.

| Field | Type | Notes |
|---|---|---|
| id, searchId | string (uuid) | |
| groupId | string \| null | null = ungrouped |
| name | string | business name |
| ownerName, address, phone, email, website, mapsUrl | string \| null | scraped, all optional |
| lat, lon | number \| null | |
| source | string \| null | where it was scraped from |
| createdAt | DateTime | |

A lead is **messageable** only if it has a non-empty phone.

## Group

A batch of leads within a Search. Auto-created **by contact channel** when a scrape finishes; the user can rename, merge, move leads, or create manual groups. Pitches are generated and sent **per group**.

| Field | Type | Notes |
|---|---|---|
| id, searchId | string (uuid) | |
| name | string | |
| kind | string | `has_email` (email+phone) \| `phone_only` \| `no_contact` \| `manual` (user-created) |
| sortOrder | number | |
| createdAt | DateTime | |

## Product

A service **we** offer (e.g. "social media management"). Scopes pitch/template generation — the AI pitches the selected product to the lead.

| Field | Type | Notes |
|---|---|---|
| id | string (uuid) | |
| name | string | |
| description | string \| null | |
| price | number \| null | |
| category | string | `website \| menu \| other` — DB `CHECK`-constrained, re-validated in `lib/schemas.ts` |
| active | boolean | |
| createdAt | DateTime | |

## Template

A reusable outreach message with `{placeholder}` tokens, optionally tied to a Product. Rendered per-lead by `renderTemplate` (`lib/repo/pitches.ts`; case-insensitive; unknown tokens left verbatim). Known tokens: `{business_name}`, `{owner_name}`, `{area}`, `{phone}`, `{email}`, `{website}`, `{business_type}`/`{business_category}`, `{your_name}`, `{your_company_name}`, `{phone_number}`, `{website_url}`.

| Field | Type |
|---|---|
| id | string (uuid) |
| name, body | string |
| productId | string \| null |
| createdAt | DateTime |

**UI note:** the sidebar page for this entity is labeled **"Templates"** (`/templates`) — it was labeled "Pitches" before the 2026-07-17 Next.js migration, which was a naming bug (it's template CRUD, not pitch review) fixed during the port.

## Message (= Pitch)

One outreach message to one lead. **A "pitch" is not a separate table — it's a `messages` row in the review phase of its lifecycle.**

| Field | Type | Notes |
|---|---|---|
| id, leadId | string (uuid) | |
| templateId | string \| null | null for AI-generated pitches |
| body | string | the actual message text |
| status | string | lifecycle below — DB `CHECK`-constrained, re-validated in `lib/schemas.ts` |
| sentAt, reviewedAt, deliveredAt, repliedAt | Date \| null | set at each transition |
| createdAt | DateTime | |

**Status lifecycle** (CHECK-constrained at the DB since the original Rust migration 006; Prisma Client does not enforce this — app-level validation in `lib/schemas.ts` is the only client-side guard):

```
draft ──► reviewed ──► queued ──► sent ──► delivered ──► replied
   └────► rejected                  └────► failed
```

Only `reviewed` pitches may be queued for sending; the send queue re-checks `queued` before each send.

**UI note:** the *actual* pitch review/approve/send flow is `components/pitches/GroupPitchDrawer.tsx`, opened from the **Leads** page — not the "Templates" page above.

## SenderProfile

The user's own identity, used to fill signature placeholders. **Singleton** — exactly one row, pre-seeded by the original migration 007 (still present in the DB; not re-seeded by Prisma). Fields: `yourName`, `companyName`, `phone`, `website` (all optional), `updatedAt`.

## PitchWithLead

Read-model for the review screen: a Message joined with its lead's `leadName` and `leadPhone`. Not a table — defined as a TS interface in `lib/repo/pitches.ts`, built by `getGroupPitches`.

## Other terms

- **Pitch modes** — `template` (merge a Template per lead) vs `ai` (Groq generates a unique message per lead).
- **Auto-group** — splitting a search's leads into `has_email` / `phone_only` / `no_contact` groups by which contact fields exist. `lib/repo/groups.ts`'s `autoGroupByContact`.
- **Send queue** — the rate-limited in-process worker (20–40s jitter between sends); the only path to WhatsApp. `lib/services/send-queue.ts`.
- **Sidecar** — the local Baileys Node process that holds the WhatsApp session (QR login, `connected` status). Unchanged by the Next.js migration.
- **Follow-up** — a sent message with no reply after N days (default 3), surfaced by `GET /api/v1/messages/followups?older_than_days=N`.
- **Dropped in the 2026-07-17 migration** (see `strategy.md` §7 for the full audit): the Dashboard page (broken stats, unused `recharts` dep), `POST /messages/send` (dead single-lead send path that bypassed the queue), `GET /templates/:id/render/:leadId` (dead single-preview endpoint). If you see references to any of these in old context, they no longer exist.
