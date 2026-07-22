-- Drop the unique constraint so generated display names can never collide
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_case_number_key;

-- Helper: build a case name from a vehicle
CREATE OR REPLACE FUNCTION public.generate_case_name(vehicle_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT (
    COALESCE(NULLIF(TRIM(v.model), ''), 'Unknown') || ', ' ||
    COALESCE(v.year::text, '—') || ' (' ||
    COALESCE(
      CASE
        WHEN v.vin IS NOT NULL AND LENGTH(v.vin) >= 6
        THEN RIGHT(v.vin, 6)
        ELSE v.vin
      END,
      '—'
    ) || ')'
  )
  FROM public.vehicles v
  WHERE v.id = vehicle_id;
$$;

-- Update all existing cases to the new naming format
UPDATE public.cases
SET case_number = public.generate_case_name(cases.vehicle_id)
WHERE cases.vehicle_id IS NOT NULL;

-- Update cases with no vehicle to a fallback name
UPDATE public.cases
SET case_number = 'Unknown, — (—)'
WHERE cases.vehicle_id IS NULL;

-- Trigger function: keep linked case names in sync when vehicle changes
CREATE OR REPLACE FUNCTION public.trg_update_case_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cases
  SET case_number = public.generate_case_name(NEW.id)
  WHERE vehicle_id = NEW.id;
  RETURN NEW;
END;
$$;

-- Attach trigger to model/year/vin changes on vehicles
DROP TRIGGER IF EXISTS trg_cases_vehicle_name ON public.vehicles;
CREATE TRIGGER trg_cases_vehicle_name
AFTER UPDATE OF model, year, vin ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.trg_update_case_names();
