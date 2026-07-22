ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS gdrive_folder_id text,
  ADD COLUMN IF NOT EXISTS gdrive_folder_url text;