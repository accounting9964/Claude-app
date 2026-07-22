ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS shipped_overseas boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_status text;