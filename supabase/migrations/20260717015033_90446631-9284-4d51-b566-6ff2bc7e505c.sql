
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS purchase_amount_3 numeric,
  ADD COLUMN IF NOT EXISTS purchase_tax_code_1 text,
  ADD COLUMN IF NOT EXISTS purchase_tax_code_2 text,
  ADD COLUMN IF NOT EXISTS purchase_tax_code_3 text;

UPDATE public.cases
SET
  purchase_tax_code_1 = COALESCE(purchase_tax_code_1, purchase_tax_code),
  purchase_tax_code_2 = COALESCE(purchase_tax_code_2, purchase_tax_code)
WHERE purchase_tax_code IS NOT NULL;
