# Lead-Gen Desktop App

A local desktop app that scrapes business leads by area and category, generates personalized AI outreach pitches, sends them via WhatsApp, and tracks replies and follow-ups. All data stays local — no cloud services required beyond the AI provider.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Tauri v2 (Rust + web frontend) |
| Backend | Rust · axum HTTP server (port 3001) |
| Database | PostgreSQL in Docker |
| WhatsApp | Baileys Node sidecar (port 3099) |
| AI / Pitches | Groq (OpenAI-compatible API) |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 · Kinetic Utility design system |
| Components | shadcn/ui |
| Server state | TanStack Query v5 |
| Client state | Zustand v5 |
| Forms | React Hook Form + Zod |
| Routing | TanStack Router v1 |

---

## Project Structure

```
marketing/
├── backend/          # Rust axum server — handlers, services, DB, migrations
├── lead-gen-app/     # React + Tauri frontend
│   ├── src/          # React app (components, pages, hooks, stores, lib)
│   └── src-tauri/    # Tauri shell (thin wrapper; business logic lives in backend/)
├── sidecar/          # Baileys WhatsApp Node.js sidecar (index.js)
├── .ai/              # Architecture, patterns, style, and coding-standards docs
├── start.ps1         # Starts all three processes
└── start.bat         # Windows batch alternative
```

---

## Prerequisites

- **Rust** (stable) + `cargo`
- **Node.js** 18+
- **Docker** (for PostgreSQL)
- **Groq API key** — free tier at [console.groq.com](https://console.groq.com)

---

## Getting Started

### 1. Start the database

```powershell
docker run -d --name postgres-client `
  -e POSTGRES_USER=yashdba `
  -e POSTGRES_PASSWORD=123456 `
  -e POSTGRES_DB=lead_gen `
  -p 5432:5432 postgres:16
```

### 2. Configure the backend

Create `backend/.env`:

```env
DATABASE_URL=postgres://yashdba:123456@localhost:5432/lead_gen
GROQ_API_KEY=your_groq_key_here
```

### 3. Start everything

```powershell
./start.ps1
```

This runs three processes in parallel:

| Process | Command | Port |
| --- | --- | --- |
| Rust backend | `cargo run` (inside `backend/`) | 3001 |
| WhatsApp sidecar | `node sidecar/index.js` | 3099 |
| Tauri dev app | `npm run tauri dev` (inside `lead-gen-app/`) | — |

> **After any backend change** — restart the Rust process. Migrations run automatically on startup via `sqlx::migrate!`.

### 4. WhatsApp pairing

On first run, the sidecar prints a QR code to the terminal. Scan it once from WhatsApp on your phone. The session is then cached locally.

---

## Lead Flow

The app implements a 7-phase pipeline:

| Phase | Description | Status |
| --- | --- | --- |
| 0 | Data model + migrations | Done |
| 1 | Business scraper (area + category → leads) | Done |
| 2 | Auto-grouping by contact channel | Done |
| 3 | Batch AI pitch generation + review drawer | Done |
| 4 | Send reviewed-only via rate-limited queue | In progress |
| 5 | Delivery tracking from sidecar callbacks | Pending |
| 6 | On-screen follow-up reminders panel | Pending |

**Core flow:** Search → Leads → auto-group by contact channel → generate per-lead AI pitch → review / edit / reject / bulk-approve → send → track delivery → follow-up reminders.

---

## Design System

UI follows the **Kinetic Utility** design system — corporate, data-dense, efficient.

- **Primary color:** `#004ac6` (Corporate Blue)
- **Background:** `#f8f9fa` (cool neutral canvas)
- **Cards:** `#ffffff` on the gray canvas for tonal elevation
- **Typography:** Inter (UI) + JetBrains Mono (IDs, phone numbers, technical data)
- **Radius:** 4 px base grid (buttons/inputs), 8 px (cards)

See `.ai/style.md` for the full token reference and component patterns.

---

## Key Docs

| File | Purpose |
| --- | --- |
| `.ai/architecture.md` | Folder structure and boundary rules |
| `.ai/patterns.md` | Canonical patterns for common tasks |
| `.ai/style.md` | Design tokens, component specs, do/don't |
| `.ai/coding-standards.md` | Rust + React/TS conventions |
| `.ai/glossary.md` | Domain terms (Search, Lead, Group, Pitch, Message) |
| `CLAUDE.md` | AI assistant behavior rules |
