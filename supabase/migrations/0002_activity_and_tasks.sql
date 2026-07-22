-- Additive only. Does not touch existing tables/columns/data.
-- Run this against the existing Supabase project before deploying the rewritten app.

-- 1. Activity log: append-only history per case (status changes, notes, docs, payments)
create table if not exists case_activity (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  kind text not null, -- 'note' | 'status_change' | 'document' | 'payment' | 'system'
  message text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists case_activity_case_id_idx on case_activity(case_id, created_at desc);

alter table case_activity enable row level security;
create policy "authenticated read case_activity" on case_activity
  for select using (auth.role() = 'authenticated');
create policy "authenticated insert case_activity" on case_activity
  for insert with check (auth.role() = 'authenticated');

-- 2. Tasks: lightweight follow-ups tied to a case ("call seller about title Friday")
create table if not exists case_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists case_tasks_case_id_idx on case_tasks(case_id);
create index if not exists case_tasks_due_idx on case_tasks(due_date) where done = false;

alter table case_tasks enable row level security;
create policy "authenticated all case_tasks" on case_tasks
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 3. Soft-archive instead of hard delete for cases that touched real money.
-- Existing hard-delete flow (deleteCaseFully) stays available for true drafts/mistakes,
-- but the UI now defaults to archiving once a bill or invoice exists.
alter table cases add column if not exists archived_at timestamptz;
create index if not exists cases_archived_idx on cases(archived_at) where archived_at is null;
