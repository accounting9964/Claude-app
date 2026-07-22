# Rewrite notes

## What this is
A rewrite of the original case-management app, focused on making it feel like
familiar business software (Salesforce/Zendesk/Trello-style patterns) rather
than a custom-built tool. Read this before deploying.

## Carried over unchanged (your working integrations)
- `src/integrations/supabase/*` — client setup, auth, types
- `src/lib/qbo/*` — QuickBooks OAuth, bill/invoice creation and sync
- `src/lib/gdrive.functions.ts` — Drive folder creation
- `src/components/ui/*` — generic UI primitives (buttons, dialogs, etc.)
- All existing database tables and columns — nothing was renamed or dropped
These were left alone on purpose: they're already tested against your real
QuickBooks and Google accounts, and I have no way to re-test them here.

## What's new
- **Board view for Cases** (default view) — a kanban-style pipeline
  (Not purchased → Purchased → Listed → With a buyer → Sold non-final →
  Sold final → Closed), the same pattern used by Trello/Salesforce/HubSpot.
  Table view is still there as a toggle.
- **Activity timeline** on every case — notes plus auto-logged events
  (bill created, invoice created) so history isn't lost. New `case_activity`
  table (see migration below).
- **Archive instead of delete** as the default way to close out a case.
  Archiving hides it from the active board/table but keeps everything —
  vehicle, contacts, QuickBooks docs, files. Hard delete still exists but is
  now a secondary, clearly-labeled "permanent" action.
- **Global search** (⌘K / Ctrl+K) across cases (by VIN) and contacts.
- **Search box + stage filters** on the cases list, replacing the long flat
  filter-chip row.
- Sellers/Buyers nav items consolidated into a single Contacts entry, since
  they were always the same underlying table.

## Before you deploy
0. **If you're starting on a brand-new, empty Supabase project** (not the
   original one with real data), run `supabase/migrations/0001_initial_schema.sql`
   first — it creates all 9 base tables, enums, RLS policies, and the
   `case-documents` storage bucket from scratch. Skip this step if you're
   using the original project, which already has this schema.
1. Run `supabase/migrations/0002_activity_and_tasks.sql` against your
   Supabase project. It's additive only — it adds two new tables
   (`case_activity`, `case_tasks`) and one new nullable column
   (`cases.archived_at`). It does not touch or delete anything existing.
2. Copy `.env.example` to `.env` and fill in your real Supabase values
   (the real `.env` was intentionally stripped out of this delivery).
3. `bun install`, then `bun run dev` — TanStack Router will regenerate
   `src/routeTree.gen.ts` automatically from the route files, since two
   route files (`_app.sellers.tsx`, `_app.buyers.tsx`) were removed.
4. Smoke-test the QBO and Drive buttons on a real case before relying on
   this in production — those code paths are unchanged from the original,
   but a full rewrite touches enough surrounding code that a real
   end-to-end check is worth the ten minutes.

## Not done in this pass (flag if you want these next)
- Tasks/reminders UI (table exists in the migration, no UI built yet)
- Drag-and-drop on the board (cards currently move by editing the case,
  not by dragging between columns)
- Multi-user roles/permissions

## Lovable independence (as of this revision)
The Google Drive integration no longer calls `connector-gateway.lovable.dev`.
It now authenticates directly to the Google Drive API using a service
account (`src/lib/gdrive.server.ts`). See deployment instructions for the
Google Cloud Console steps and the new env vars:
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
`GDRIVE_CASES_PARENT_FOLDER_ID`. `LOVABLE_API_KEY` and `GOOGLE_DRIVE_API_KEY`
are no longer used anywhere in the code.

This revision also removed every other Lovable dependency found on a full
sweep of the codebase:
- `vite.config.ts` no longer wraps `@lovable.dev/vite-tanstack-config`
  (which pulled in Lovable-hosted build plugins). It's now a plain
  TanStack Start + Nitro config — see the file for what's included.
- `@lovable.dev/cloud-auth-js` — the login page's **only** sign-in method
  was Google via this Lovable auth broker, not email/password as I said
  earlier in our conversation (that was a mistake on my part). It's now
  swapped for Supabase's own native Google OAuth
  (`supabase.auth.signInWithOAuth`). **Before deploying, go to your
  Supabase project > Authentication > Providers > Google, and configure a
  Google OAuth client (Client ID + Secret) there.** This is a different,
  simpler kind of Google credential than the service account used for
  Drive — you'll create it in the same Google Cloud project, under
  APIs & Services > Credentials > Create Credentials > OAuth client ID
  (type: Web application), with the authorized redirect URI Supabase shows
  you on that same settings page.
- `qbo.server.ts` had a hardcoded fallback to a `*.lovable.app` preview
  URL if `QBO_REDIRECT_URI` was missing — this would have silently sent
  QuickBooks OAuth to a dead Lovable preview link in production. It now
  throws a clear error instead if the env var isn't set.
- Removed the `src/integrations/lovable/` folder, `lovable-error-reporting.ts`,
  `AGENTS.md`, and the `@lovable.dev/*` entries from `package.json` and
  `bunfig.toml`. Deleted the old lockfiles — run a fresh install once
  (`bun install` or `npm install`) to generate a new one without any
  `@lovable.dev/*` packages in it.
