# RidgeTheory CRM — System Documentation

RidgeTheory is a B2B sales CRM and revenue workspace. It covers lead intake, scoring, email verification, multi-channel prospecting sequences, deal pipeline management, and day-to-day sales operations. The product is built as a Next.js 14 web app with TypeScript, Tailwind CSS, and Supabase (PostgreSQL) as the production data store.

---

## Overview

The system is designed for a small sales team that needs more than a contact list: it supports the full motion from raw lead import through outbound sequences to closed deals.

Core capabilities:

- **Lead management** — import, score, verify emails, segment, and track lifecycle status
- **Automated prospecting** — tiered multi-day sequences across email, LinkedIn, and phone
- **Pipeline** — Kanban-style deal board with activities and linked tasks
- **Account management** — companies and contacts with relationships to deals and leads
- **Dashboard** — revenue KPIs, today's outreach queue, and operational summaries
- **Authentication and roles** — Supabase Auth with admin, manager, and sales roles

The app runs in two modes:

- **Local/demo mode** — when Supabase is not configured, data lives in browser `localStorage` with seed data and a demo admin profile
- **Production mode** — when Supabase credentials are set, data is persisted in PostgreSQL with row-level security (RLS)

---

## Technology Stack

- **Frontend framework** — Next.js 14 (App Router), React 18, TypeScript
- **Styling** — Tailwind CSS with shadcn/ui-style design tokens and Radix UI primitives
- **Database** — Supabase (PostgreSQL) with RLS policies
- **Auth** — Supabase Auth with profile records and role-based access
- **State management** — React hooks (`useCRM`, `useAuth`) with a module-level cache for fast re-renders
- **External services**
  - **Reoon** — email verification and cleansing
  - **OpenAI** — AI-generated prospecting copy
  - **Resend** — outbound email delivery

---

## Application Architecture

### Routing and shell

Each main section has its own App Router page (`/dashboard`, `/leads`, `/prospecting`, etc.). All routes render the shared `CRMShell` component, which handles:

- Session loading and auth gating
- Sidebar navigation and top bar
- Global modals (create company, lead, contact, deal, task)
- Global search (`Ctrl+K` / `Cmd+K`)

The root path (`/`) redirects to `/dashboard`.

### Data flow

```
User action (view/modal)
    → useCRM hook
    → backend/crm/* (create/update/delete/fetch)
    → Supabase OR localStorage
    → React state update + localStorage mirror
    → UI re-render
```

The `useCRM` hook is the single source of truth for all CRM entities. It exposes arrays (companies, leads, contacts, deals, activities, tasks, prospecting sequences, sequence tasks) and CRUD operations.

The `backend/crm/` layer abstracts persistence:

- With Supabase configured: reads/writes go to PostgreSQL
- Without Supabase: operations use in-memory state mirrored to `localStorage`

### Project structure (key areas)

- `src/app/` — Next.js routes and API endpoints
- `src/views/` — page-level UI (Dashboard, Leads, Prospecting, Companies, Contacts, Pipeline, Tasks)
- `src/components/` — layout, modals, auth, outreach, UI primitives
- `src/hooks/` — `useCRM`, `useAuth`, `useImportExport`
- `src/backend/crm/` — data access layer per entity
- `src/lib/` — business logic (scoring, prospecting templates, email cleansing, daily queue)
- `src/types/` — TypeScript types and constants
- `supabase-schema.sql` — full database schema, triggers, RLS policies, indexes

---

## Authentication and Authorization

### How sign-in works

When Supabase is configured:

- Users sign in or sign up via the `AuthScreen`
- On signup, a database trigger (`handle_new_user`) creates a `profiles` row
- The **first user** in the system automatically receives the `admin` role; all subsequent users default to `sales`
- The session is managed by Supabase Auth; profile data (name, email, role) is loaded from the `profiles` table

When Supabase is **not** configured:

- The app skips real auth and uses a hardcoded demo admin profile (`demo@salescrm.local`)
- Sign-out resets to the demo profile rather than logging out

### Roles and permissions

Three roles exist: `admin`, `manager`, and `sales`.

- **Admin** — full access; can manage user profiles; sees all records
- **Manager** — sees and manages all CRM records; can import/export
- **Sales** — sees and manages only records they own (`owner_id` matches their user ID)

Row-level security enforces this at the database level. Admins and managers can read/write any record; sales users are restricted to their own `owner_id`.

### Notes on auth

- Restart the dev server after changing `.env.local` Supabase keys
- If email confirmation is enabled in Supabase, new users must confirm before signing in
- Profile role changes must be done directly in the `profiles` table (admin-only update policy)

---

## Data Model

### Core entities and relationships

**Companies** represent target or customer organizations.

- Fields: name, industry, website, size, tags
- Linked to: contacts, leads, deals

**Leads** are pre-contact prospects, often imported in bulk.

- Fields: name, title, email, phone, company name, website, source, ingestion source, status, notes, tags, scoring fields, email validation fields, segment
- Optional links: `company_id`, `contact_id` (when promoted)
- Scoring: interest, decision-maker, fit, overall score, rank tier, pain theme

**Contacts** are qualified people in the CRM.

- Fields: name, title, email, phone, LinkedIn, lead source, status, tags
- Linked to: company, deals, tasks

**Deals** are revenue opportunities.

- Fields: title, value, stage, probability, close date, notes
- Linked to: company, contact
- Stages: Lead → Qualified → Proposal → Negotiation → Closed Won / Closed Lost

**Activities** are logged interactions on deals.

- Types: note, call, email, meeting
- Always tied to a `deal_id`

**Tasks** are follow-up items.

- Fields: title, due date, priority (low/medium/high), status (open/done)
- Optionally linked to a deal or contact

**Prospecting sequences** are outbound campaigns for a single lead.

- One active sequence per lead at a time
- Tier: `high` or `low` (based on lead score)
- Status: active, paused, completed

**Sequence tasks** are individual steps in a sequence.

- Channel: email, linkedin, phone
- Due date calculated from sequence start date + day number
- Pre-generated subject, body, and script
- Status: pending, sent, done, skipped

### Lead lifecycle

Leads move through a defined status pipeline:

1. **Generated** — auto-imported leads
2. **Augmented** — enriched with additional data (reserved for future automation)
3. **Cleaned** — email verified as valid via Reoon
4. **Entered** — manually added leads
5. **Prospecting** — enrolled in an active sequence
6. **Qualified** — sequence completed successfully
7. **Disqualified** — removed from outreach

Status only moves forward in the pipeline (except disqualification). Enrolling in a sequence advances status to Prospecting. Completing all sequence tasks advances to Qualified.

### Lead segments

- **Raw** — default; no response yet
- **Warm** — lead has responded; set via "Promote to warm" action with a `responded_at` timestamp

### Deal stage probabilities

Each stage has a default win probability used for weighted forecast:

- Lead: 10%
- Qualified: 25%
- Proposal: 50%
- Negotiation: 75%
- Closed Won: 100%
- Closed Lost: 0%

Moving a deal stage in the Pipeline view automatically updates probability.

---

## Feature Guide: Dashboard

The Dashboard is the operational home screen.

**What you see:**

- **Today's outreach** — pending sequence tasks due today or earlier, grouped by channel
- **KPI cards**
  - Pipeline value (sum of open deal values)
  - Weighted forecast (value × probability)
  - Deals closing this month
  - Overdue task count (clickable → Tasks page)
- **Pipeline by stage** — bar chart of open deal value per stage (Lead through Negotiation)
- **Lead sources** — distribution of contact lead sources
- **Upcoming tasks** — next 5 open, non-overdue tasks with quick complete checkbox
- **Recent activity** — last 6 deal activities

**How to use:**

- Use **+ New** to create any record type from a dropdown
- Click overdue tasks KPI to jump to Tasks
- Review today's outreach before starting prospecting work

---

## Feature Guide: Leads

The Leads page is where inbound and imported prospects are managed.

**Filtering and views:**

- **Status buckets** — All, New, Prospecting, Qualified, Disqualified
- **Segment filter** — All, Raw, Warm
- **Search** — filters by name, email, company, title
- **Pagination** — 20 leads per page

**Key actions:**

- **Add lead** — manual entry via modal; triggers scoring and optional email verification
- **Import CSV** — bulk import with auto-mapping of common column headers
- **Enroll in sequence** — scores the lead, creates a prospecting sequence and all sequence tasks
- **Bulk enroll / bulk delete** — multi-select operations
- **Lead profile sheet** — side panel with full lead detail, scores, email status, notes, and actions (rescore, reverify email, promote to warm, enroll, disqualify)

**CSV import fields:**

`name`, `title`, `email`, `phone`, `company_name`, `website`, `source`, `ingestion_source`, `status`, `notes`

At minimum, each row needs a `name` or `title`. Imported leads go through the same scoring and email verification pipeline as manually added leads.

**Email validity badges:**

- **Valid** — Reoon confirmed deliverable
- **Invalid** — failed verification (hover for reason)
- **Unverified** — no email or verification not run

---

## Feature Guide: Prospecting

The Prospecting page is the daily execution workspace for outbound sequences.

**Tabs:**

- **Email** — due email tasks with subject/body preview, send, AI regenerate, bulk send
- **LinkedIn** — connection and engagement tasks with LinkedIn search helper
- **Phone** — call tasks with generated scripts
- **Upcoming** — future pending tasks not yet due

**Email workflow:**

1. Tasks appear when `due_date <= today` and status is `pending`
2. Each task ships with a **fallback draft** generated at enrollment
3. Click **Generate with AI** to replace the draft via OpenAI (requires `OPENAI_API_KEY`)
4. Review/edit subject and body in the expanded task panel
5. Click **Send** to deliver via Resend (requires `RESEND_API_KEY`)
6. Sent tasks are marked `sent` with timestamp and Resend message ID

**LinkedIn and phone tasks:**

- Mark as **Done** or **Skip** when completed
- LinkedIn button opens a pre-built search URL for the lead

**Sequence completion:**

When every task in a sequence reaches a terminal status (`sent`, `done`, or `skipped`), the sequence is marked `completed` and the lead status advances to **Qualified**.

### Sequence templates

**High-touch** (overall score ≥ 70) — 8 steps over 14 days:

- Day 1: Email opener (automatic)
- Day 3: Value-add email (automatic)
- Day 4: LinkedIn connection (manual)
- Day 6: Phone call (manual)
- Day 8: New-angle email (automatic)
- Day 10: LinkedIn engagement (manual)
- Day 12: Follow-up call (manual)
- Day 14: Breakup email (automatic)

**Low-touch** (score < 70) — 4 steps over 10 days:

- Day 1: Light opener email
- Day 4: Resource email
- Day 7: Optional LinkedIn check
- Day 10: Close-loop email

---

## Feature Guide: Dialer (Call step)

Ported from the `RidgeTheoryllc/Call_Number_Rotation` project. Opening **Prospecting → Call** registers a Twilio Voice device in the browser. Each row has a **Call** button; expanding a row shows the lead's call history, recordings, and notes. **Mark done** still triggers the close email; calling does not complete the task by itself.

**Flow:** `POST /api/twilio/call` picks the best caller ID from the rep's pool → Twilio rings the rep's browser (`client:agent-{userId}`, auto-accepted) → `/api/twilio/voice` puts the rep in a conference and dials the lead → `/api/twilio/call-status` writes `call_logs` (result taken from the lead's leg) and re-scores the DID.

**Caller ID rotation** (`src/lib/dialer/didEngine.ts`): `score = +50 local area code + answer_rate×0.5 − spam×0.3 − calls_today×0.2`. Daily warmup caps go 50 → 70 → 85 → 100 over the first four days. Spam score rises on unanswered calls; above 80 the number moves to cooldown, and above 95 it is retired.

**Dialer page** (`/dialer`): manage the caller ID pool and view recent calls.

**Setup:**

1. Run `supabase/migrations/call-rotation.sql`.
2. Set the Twilio variables in `.env.local.example`.
3. Create a TwiML App with Voice URL `{TWILIO_WEBHOOK_BASE_URL}/api/twilio/voice`.
4. Add your Twilio numbers on `/dialer`.

Locally, Twilio needs a public tunnel (`ngrok http 3000`) as `TWILIO_WEBHOOK_BASE_URL`. Webhooks are verified with `X-Twilio-Signature`.

**Not ported yet:** inbound callbacks to pool numbers, SMS, Connect Call (3-way), superadmin console, auto-dial.

---

## Feature Guide: Companies and Contacts

**Companies** — list, search, create, edit, delete. Tags supported. Deleting a company nullifies references on contacts, leads, and deals (does not cascade-delete them).

**Contacts** — list, search, create, edit, delete. Link to a company. Status tracks lifecycle: Lead → Prospect → Customer → Churned. Deleting a contact nullifies deal, lead, and task references.

---

## Feature Guide: Pipeline

Kanban board with six columns matching deal stages.

**Interactions:**

- **Drag and drop** deals between columns to change stage
- **Click a deal card** to open the detail sheet
- In the sheet: edit deal, log activity, add tasks, view activity timeline and linked tasks
- **+ New deal** creates a deal linked to optional company and contact

Closed Won and Closed Lost deals remain visible in their columns but are excluded from dashboard pipeline calculations.

---

## Feature Guide: Tasks

Standalone task list for follow-ups not tied to prospecting sequences.

- Filter by status (open/done)
- Priority badges (low, medium, high)
- Overdue tasks highlighted in red
- Tasks can link to a deal and/or contact
- Checkbox to mark complete

---

## Feature Guide: Global Search

Press `Ctrl+K` (Windows) or `Cmd+K` (Mac), or click the search button in the top bar.

Searches across companies, contacts, leads, and deals by name/title/email. Selecting a result navigates to the relevant section.

---

## Lead Scoring System

Scoring runs automatically on lead creation and can be re-run manually.

**Three sub-scores (0–100 each):**

- **Decision-maker score** — seniority keywords in title/notes (founder, CEO, VP, director, etc.) and decision-maker tags
- **Interest score** — inbound signals (website, referral source), interest keywords (budget, security, automation, etc.)
- **Fit score** — completeness of contact data (email, phone, company, website, title)

**Overall score** — weighted average:

- Interest: 35%
- Decision-maker: 40%
- Fit: 25%

**Rank tier:**

- `high` if overall score ≥ 70
- `low` otherwise

**Pain theme** — inferred from text: security, scalability, cost, or operations (default). Used to personalize outreach copy.

---

## Email Verification (Reoon)

When a lead has an email address:

1. On create (and on manual reverify), the app calls `/api/email/verify`
2. Reoon checks deliverability, disposable domains, role accounts, catch-all, etc.
3. Results are stored on the lead: `email_status`, `email_valid`, `email_validated_at`
4. A summary note is appended to lead notes
5. Valid emails advance status toward **Cleaned**

If `REOON_API_KEY` is not set, verification is skipped silently (API returns 503, no error shown to user).

**Reoon environment variables:**

- `REOON_API_KEY` — your API key
- `REOON_VERIFY_MODE` — verification mode (default: `power`)

---

## Import and Export

**CSV import** — available on the Leads page (and via `useImportExport` for other entities). Column headers are auto-mapped to known field names.

**CSV export** — exports current data for leads, companies, contacts, or deals (excludes internal IDs and tags).

**JSON backup** — full export of companies, contacts, deals, activities, and tasks.

Import/export permissions: admin and manager roles (when role checks are applied in UI).

---

## API Routes (Server-Side)

All external API keys stay server-side in `.env.local` — never exposed to the browser.

- **`POST /api/email/verify`** — Reoon email verification; body: `{ email }`
- **`POST /api/email/send`** — Resend email delivery; body: `{ to, subject, text }`
- **`POST /api/ai/prospecting-draft`** — OpenAI draft generation; body: lead and task context fields

---

## Environment Configuration

Copy `.env.local.example` to `.env.local` and fill in values:

**Required for Supabase (production):**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Optional integrations:**

- `OPENAI_API_KEY` — AI prospecting drafts
- `OPENAI_MODEL` — defaults to `gpt-4o-mini`
- `RESEND_API_KEY` — email sending
- `RESEND_FROM_EMAIL` — fallback sender address
- `OUTREACH_FROM_EMAIL` — preferred sender for outreach emails
- `REOON_API_KEY` — email verification
- `REOON_VERIFY_MODE` — Reoon verification mode
- `OUTREACH_PHONE` — included in email sign-offs and call scripts

Restart `npm run dev` after changing environment variables.

---

## Database Setup Guide

1. Create a project at [supabase.com](https://supabase.com)
2. Open the SQL Editor and run the full `supabase-schema.sql` script
3. This creates:
   - All tables with indexes
   - The `profiles` table and `handle_new_user` trigger
   - `current_user_role()` helper function
   - Row-level security policies for all tables
4. Add Supabase URL and anon key to `.env.local`
5. Sign up the first user — they become admin automatically
6. Assign roles to additional users via the `profiles` table in Supabase

### RLS policy summary

- **Profiles** — users read their own profile; admins read all; only admins can update profiles
- **All CRM tables** — admins and managers have full access; sales users can only access records where `owner_id = auth.uid()`

### Indexes

Indexes exist on common query patterns: `owner_id`, `status`, `stage`, `company_id`, `contact_id`, `deal_id`, `due_date`, `overall_score`, `rank_tier`, and sequence relationships.

---

## Local Development Guide

```bash
cd crm
npm install
npm run dev
```

Open `http://localhost:3000`.

**Without Supabase** — the app loads immediately with seed data (sample companies, contacts, deals, leads). No login required; demo admin profile is used.

**With Supabase** — login screen appears; data persists across sessions and devices.

**Production build:**

```bash
npm run build
npm start
```

---

## Operational Notes and Best Practices

**Lead workflow recommendation:**

1. Import or add leads on the Leads page
2. Review scores and email validity badges
3. Disqualify invalid or irrelevant leads
4. Enroll qualified leads in sequences (high-score leads get the 14-day high-touch track)
5. Execute daily outreach from Dashboard or Prospecting
6. Promote responders to Warm segment
7. Convert qualified leads to Contacts and Companies when ready
8. Create Deals in Pipeline and track through close

**Data ownership:**

- In Supabase mode, new records get `owner_id` set to the current user
- Sales reps only see their own pipeline; managers and admins see everything

**Deleting records:**

- Deleting a company, contact, or deal does not delete related records — foreign keys are set to `null`
- Deleting a lead cascades to its prospecting sequences and sequence tasks
- Deleting a deal removes its activities and unlinks its tasks

**Caching behavior:**

- `useCRM` keeps a module-level cache so navigation between pages does not re-fetch from Supabase on every route change
- In Supabase mode, fresh data is fetched on profile load; cached data shows immediately while fetching

**Fallback behavior:**

- If Supabase fetch fails, the app falls back to localStorage data and shows an error
- If OpenAI is unavailable, pre-generated fallback drafts from enrollment are still usable
- If Reoon is unavailable, leads are created without email validation

**Branding:**

- The app displays as **RidgeTheory — Revenue workspace** in the sidebar and metadata
- Outreach copy is written for RidgeTheory (custom dashboards and internal systems for growing companies)

---

## Known Limitations

- Import/Export page exists in code (`ImportExport.tsx`) but is not currently in the sidebar navigation
- `supabase.ts` Database type does not include `prospecting_sequences` and `sequence_tasks` tables (runtime still works)
- Activities cannot be created standalone — they require an open deal (via Pipeline detail sheet)
- No real-time sync between multiple browser tabs (state is per-session with cache)
- LinkedIn and phone steps are manual — no automated LinkedIn API or dialer integration
- First-user-admin assignment only applies at signup time; no in-app user management UI for admins

---

## Troubleshooting

**"Connect Supabase" screen on startup**

- Add valid `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local` and restart the dev server

**Leads not persisting**

- Without Supabase, data is in browser localStorage only — clearing browser data wipes it
- With Supabase, check RLS policies and that the user is authenticated

**Email send fails**

- Verify `RESEND_API_KEY` and `OUTREACH_FROM_EMAIL` (or `RESEND_FROM_EMAIL`)
- Resend requires a verified sending domain for production use

**AI draft generation fails**

- Verify `OPENAI_API_KEY` is set
- Check server logs for OpenAI API errors or rate limits

**Email verification always shows "Unverified"**

- Verify `REOON_API_KEY` is set
- API returns 503 when Reoon is not configured — this is expected in local-only mode

**Sales user cannot see records**

- Records may have a different `owner_id` — managers/admins can see all; sales users only see their own
- Check the `owner_id` column in Supabase for the record in question

---

This documentation reflects the current RidgeTheory CRM codebase. For schema changes, update `supabase-schema.sql` and re-run migrations in Supabase. For new features, extend `useCRM` and the corresponding `backend/crm/` module to keep the data layer consistent.
