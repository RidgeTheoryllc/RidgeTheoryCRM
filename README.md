# SalesCRM

A B2B Sales CRM built with Next.js 14, TypeScript, Tailwind CSS, and Supabase.

## Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui design tokens
- **Database**: Supabase (PostgreSQL)
- **State**: React hooks (localStorage until Supabase is wired up)

## Getting started

```bash
npm install
npm run dev
```

## Supabase setup

1. Create a Supabase project at https://supabase.com
2. Run `supabase-schema.sql` in your Supabase SQL editor
3. Copy `.env.local.example` to `.env.local` and fill in your keys
4. Search for `TODO (Supabase)` in `src/hooks/useCRM.ts` and replace the localStorage calls with Supabase queries

## Project structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main CRM shell (routing + modals)
│   └── globals.css         # Tailwind + shadcn CSS variables
│
├── types/
│   └── index.ts            # All TypeScript types + constants
│
├── lib/
│   ├── utils.ts            # cn(), formatCurrency(), formatDate() etc.
│   ├── supabase.ts         # Supabase client
│   └── seed.ts             # Dev seed data
│
├── hooks/
│   ├── useCRM.ts           # Main data hook (all CRUD, marked for Supabase)
│   └── useImportExport.ts  # CSV/JSON import and export logic
│
├── components/
│   ├── ui/
│   │   ├── atoms.tsx       # Badge, Avatar, ProgressBar, EmptyState
│   │   ├── badges.tsx      # StageBadge, StatusBadge, PriorityBadge
│   │   └── TagInput.tsx    # Freeform tag input component
│   ├── layout/
│   │   └── Sidebar.tsx     # Sidebar nav + TopBar
│   └── modals/
│       └── index.tsx       # All forms + GlobalSearch + NewDropdown
│
└── pages/                  # One file per page (not Next.js pages router)
    ├── Dashboard.tsx
    ├── Companies.tsx
    ├── Contacts.tsx
    ├── Pipeline.tsx
    ├── Tasks.tsx
    └── ImportExport.tsx
```

## Supabase migration path

All localStorage calls are in `src/hooks/useCRM.ts`. Each function has a `// TODO (Supabase)` comment showing exactly which Supabase query to use. Example:

```ts
// Before (localStorage)
const addCompany = (data) => {
  const record = { ...data, id: uid(), created_at: new Date().toISOString() }
  setCompanies(prev => { const next = [...prev, record]; saveKey('crm:companies', next); return next })
}

// After (Supabase)
const addCompany = async (data) => {
  const { data: record } = await supabase.from('companies').insert(data).select().single()
  setCompanies(prev => [...prev, record])
}
```

The database schema is in `supabase-schema.sql`.
