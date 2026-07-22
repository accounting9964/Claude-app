
-- Enums
CREATE TYPE public.contact_kind AS ENUM ('seller', 'buyer', 'both');
CREATE TYPE public.vehicle_status AS ENUM ('in_stock', 'pending', 'sold');
CREATE TYPE public.case_status AS ENUM ('draft', 'purchased', 'listed', 'sold', 'closed');
CREATE TYPE public.txn_kind AS ENUM ('bill', 'invoice');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- contacts
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.contact_kind NOT NULL DEFAULT 'seller',
  display_name text NOT NULL,
  company_name text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  qbo_customer_id text,
  qbo_vendor_id text,
  qbo_sync_token text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read contacts"  ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update contacts" ON public.contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete contacts" ON public.contacts FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- vehicles
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vin text UNIQUE,
  stock_number text,
  year int,
  make text,
  model text,
  trim text,
  color text,
  mileage int,
  status public.vehicle_status NOT NULL DEFAULT 'in_stock',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read vehicles"  ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write vehicles" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update vehicles" ON public.vehicles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete vehicles" ON public.vehicles FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- cases
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text UNIQUE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  buyer_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  status public.case_status NOT NULL DEFAULT 'draft',
  purchase_price numeric(12,2),
  sale_price numeric(12,2),
  purchase_date date,
  sale_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cases"  ON public.cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write cases" ON public.cases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cases" ON public.cases FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete cases" ON public.cases FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_cases_updated BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- case_transactions
CREATE TABLE public.case_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  kind public.txn_kind NOT NULL,
  amount numeric(12,2) NOT NULL,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  qbo_doc_id text,
  qbo_sync_token text,
  qbo_doc_number text,
  is_paid boolean NOT NULL DEFAULT false,
  due_date date,
  memo text,
  last_synced_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_transactions TO authenticated;
GRANT ALL ON public.case_transactions TO service_role;
ALTER TABLE public.case_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read txns"  ON public.case_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write txns" ON public.case_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update txns" ON public.case_transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete txns" ON public.case_transactions FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_txns_updated BEFORE UPDATE ON public.case_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- qbo_tokens (per-user)
CREATE TABLE public.qbo_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  realm_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  access_token_expires_at timestamptz NOT NULL,
  refresh_token_expires_at timestamptz,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qbo_tokens TO authenticated;
GRANT ALL ON public.qbo_tokens TO service_role;
ALTER TABLE public.qbo_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own qbo read"   ON public.qbo_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own qbo write"  ON public.qbo_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own qbo update" ON public.qbo_tokens FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own qbo delete" ON public.qbo_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_qbo_updated BEFORE UPDATE ON public.qbo_tokens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
