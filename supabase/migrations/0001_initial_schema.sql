-- Full base schema for a fresh, empty Supabase project.
-- Run this FIRST, then run 0002_activity_and_tasks.sql after.
-- Safe to run once on an empty project — every statement uses IF NOT EXISTS
-- so re-running it won't error, but it will not fix a partially-broken state.

-- ============ ENUMS ============
do $$ begin
  create type case_status as enum ('draft','purchased','listed','sold','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type contact_kind as enum ('seller','buyer','both','lessee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_kind as enum ('registration','bill_from_seller','invoice_to_buyer','lien_release','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type txn_kind as enum ('bill','invoice');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vehicle_status as enum ('in_stock','pending','sold');
exception when duplicate_object then null; end $$;

-- ============ TABLES ============

create table if not exists vehicle_makes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists vehicle_models (
  id uuid primary key default gen_random_uuid(),
  make_id uuid references vehicle_makes(id),
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  make text,
  model text,
  trim text,
  year int,
  vin text,
  color text,
  mileage int,
  stock_number text,
  notes text,
  status vehicle_status not null default 'in_stock',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  kind contact_kind not null default 'buyer',
  company_name text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  notes text,
  qbo_customer_id text,
  qbo_vendor_id text,
  qbo_sync_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  case_number text,
  vehicle_id uuid references vehicles(id),
  seller_id uuid references contacts(id),
  buyer_id uuid references contacts(id),
  trade_in_lessee_id uuid references contacts(id),
  status case_status not null default 'draft',

  is_purchased boolean not null default false,
  purchase_date date,
  purchase_price numeric,
  purchase_amount_1 numeric,
  purchase_amount_2 numeric,
  purchase_amount_3 numeric,
  purchase_tax_code text,
  purchase_tax_code_1 text,
  purchase_tax_code_2 text,
  purchase_tax_code_3 text,
  purchase_tax_amount numeric,
  purchase_total numeric,

  has_buyer_in_mind boolean not null default false,
  listed_on_marketplace boolean not null default false,
  is_sold boolean not null default false,
  sale_is_final boolean not null default false,
  sale_date date,
  sale_price numeric,
  sale_amount_1 numeric,
  sale_amount_2 numeric,
  sale_tax_code text,
  sale_tax_amount numeric,
  sale_total numeric,

  in_inventory boolean not null default false,
  in_possession boolean not null default false,
  is_mb boolean not null default false,
  is_trade_in boolean not null default false,
  shipped_overseas boolean not null default false,
  shipping_status text,

  title_from_seller_received_at timestamptz,
  title_to_buyer_provided_at timestamptz,
  atac_from_seller_received_at timestamptz,
  atac_to_buyer_provided_at timestamptz,

  qbo_bill_id text,
  qbo_bill_doc_number text,
  qbo_bill_synced_at timestamptz,
  qbo_bill_deleted_at timestamptz,
  qbo_invoice_id text,
  qbo_invoice_doc_number text,
  qbo_invoice_synced_at timestamptz,
  qbo_invoice_deleted_at timestamptz,

  gdrive_folder_id text,
  gdrive_folder_url text,

  needs_attention boolean not null default false,
  attention_note text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists cases_vehicle_id_idx on cases(vehicle_id);
create index if not exists cases_seller_id_idx on cases(seller_id);
create index if not exists cases_buyer_id_idx on cases(buyer_id);

create table if not exists case_transactions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  kind txn_kind not null,
  amount numeric not null,
  amount_paid numeric not null default 0,
  is_paid boolean not null default false,
  due_date date,
  memo text,
  qbo_doc_id text,
  qbo_doc_number text,
  qbo_sync_token text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists case_transactions_case_id_idx on case_transactions(case_id);

create table if not exists case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  kind document_kind not null default 'other',
  file_name text not null,
  file_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id)
);
create index if not exists case_documents_case_id_idx on case_documents(case_id);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists qbo_tokens (
  user_id uuid primary key references auth.users(id),
  realm_id text not null,
  environment text not null default 'production',
  access_token text not null,
  access_token_expires_at timestamptz not null,
  refresh_token text not null,
  refresh_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ ROW LEVEL SECURITY ============
-- Single-tenant internal tool: any signed-in user can read/write everything.
-- (qbo_tokens is the one exception — each user only sees their own tokens.)

alter table vehicle_makes enable row level security;
alter table vehicle_models enable row level security;
alter table vehicles enable row level security;
alter table contacts enable row level security;
alter table cases enable row level security;
alter table case_transactions enable row level security;
alter table case_documents enable row level security;
alter table profiles enable row level security;
alter table qbo_tokens enable row level security;

do $$
declare t text;
begin
  foreach t in array array['vehicle_makes','vehicle_models','vehicles','contacts','cases','case_transactions','case_documents','profiles']
  loop
    execute format('drop policy if exists "authenticated all" on %I', t);
    execute format('create policy "authenticated all" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')', t);
  end loop;
end $$;

drop policy if exists "own tokens" on qbo_tokens;
create policy "own tokens" on qbo_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ STORAGE ============
-- Private bucket for uploaded case documents (titles, ATAC forms, etc).
insert into storage.buckets (id, name, public)
values ('case-documents', 'case-documents', false)
on conflict (id) do nothing;

drop policy if exists "authenticated read case-documents" on storage.objects;
create policy "authenticated read case-documents" on storage.objects
  for select using (bucket_id = 'case-documents' and auth.role() = 'authenticated');

drop policy if exists "authenticated write case-documents" on storage.objects;
create policy "authenticated write case-documents" on storage.objects
  for insert with check (bucket_id = 'case-documents' and auth.role() = 'authenticated');

drop policy if exists "authenticated delete case-documents" on storage.objects;
create policy "authenticated delete case-documents" on storage.objects
  for delete using (bucket_id = 'case-documents' and auth.role() = 'authenticated');
