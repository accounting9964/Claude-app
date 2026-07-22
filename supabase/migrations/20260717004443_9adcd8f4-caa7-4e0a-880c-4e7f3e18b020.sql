ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS has_seller_in_mind boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_purchased boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS in_possession boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS in_inventory boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_sold boolean NOT NULL DEFAULT false;