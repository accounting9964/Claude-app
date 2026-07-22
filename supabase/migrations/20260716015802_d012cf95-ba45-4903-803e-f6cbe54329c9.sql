ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS sale_is_final boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listed_on_marketplace boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS title_from_seller_received_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS atac_from_seller_received_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS title_to_buyer_provided_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS atac_to_buyer_provided_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS needs_attention boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attention_note text NULL;