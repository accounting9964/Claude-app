
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS qbo_bill_doc_number text,
  ADD COLUMN IF NOT EXISTS qbo_invoice_doc_number text,
  ADD COLUMN IF NOT EXISTS qbo_bill_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS qbo_invoice_deleted_at timestamptz;
