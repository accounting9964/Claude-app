
-- Vehicle makes
CREATE TABLE public.vehicle_makes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.vehicle_makes TO authenticated;
GRANT ALL ON public.vehicle_makes TO service_role;
ALTER TABLE public.vehicle_makes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read makes" ON public.vehicle_makes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert makes" ON public.vehicle_makes FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

-- Vehicle models
CREATE TABLE public.vehicle_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make_id UUID NOT NULL REFERENCES public.vehicle_makes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (make_id, name)
);
GRANT SELECT, INSERT ON public.vehicle_models TO authenticated;
GRANT ALL ON public.vehicle_models TO service_role;
ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read models" ON public.vehicle_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert models" ON public.vehicle_models FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

-- Seed from existing vehicles
INSERT INTO public.vehicle_makes (name)
  SELECT DISTINCT trim(make) FROM public.vehicles WHERE make IS NOT NULL AND trim(make) <> ''
  ON CONFLICT (name) DO NOTHING;
INSERT INTO public.vehicle_models (make_id, name)
  SELECT vm.id, trim(v.model)
  FROM public.vehicles v
  JOIN public.vehicle_makes vm ON vm.name = trim(v.make)
  WHERE v.model IS NOT NULL AND trim(v.model) <> ''
  ON CONFLICT (make_id, name) DO NOTHING;

-- Document kind enum
CREATE TYPE public.document_kind AS ENUM ('registration','bill_from_seller','invoice_to_buyer','lien_release','other');

-- Case documents
CREATE TABLE public.case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  kind public.document_kind NOT NULL DEFAULT 'other',
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_documents TO authenticated;
GRANT ALL ON public.case_documents TO service_role;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read case docs" ON public.case_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert case docs" ON public.case_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by OR uploaded_by IS NULL);
CREATE POLICY "owner delete case docs" ON public.case_documents FOR DELETE TO authenticated USING (auth.uid() = uploaded_by);

-- Storage RLS for case-documents bucket (bucket created via tool)
CREATE POLICY "case docs read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'case-documents');
CREATE POLICY "case docs upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'case-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "case docs delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'case-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
