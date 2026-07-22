
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS is_trade_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trade_in_lessee_id uuid REFERENCES public.contacts(id),
  ADD COLUMN IF NOT EXISTS is_mb boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purchase_amount_1 numeric,
  ADD COLUMN IF NOT EXISTS purchase_amount_2 numeric,
  ADD COLUMN IF NOT EXISTS purchase_tax_code text,
  ADD COLUMN IF NOT EXISTS purchase_tax_amount numeric,
  ADD COLUMN IF NOT EXISTS purchase_total numeric,
  ADD COLUMN IF NOT EXISTS sale_amount_1 numeric,
  ADD COLUMN IF NOT EXISTS sale_amount_2 numeric,
  ADD COLUMN IF NOT EXISTS sale_tax_code text,
  ADD COLUMN IF NOT EXISTS sale_tax_amount numeric,
  ADD COLUMN IF NOT EXISTS sale_total numeric;

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_vin_unique_ci
  ON public.vehicles (lower(vin))
  WHERE vin IS NOT NULL;
