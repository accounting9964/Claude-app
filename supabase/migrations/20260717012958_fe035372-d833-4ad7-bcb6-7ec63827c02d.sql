-- When a case is deleted, also delete its associated vehicle so inventory stays in sync
CREATE OR REPLACE FUNCTION public.delete_case_vehicle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.vehicle_id IS NOT NULL THEN
    DELETE FROM public.vehicles WHERE id = OLD.vehicle_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_case_vehicle ON public.cases;
CREATE TRIGGER trg_delete_case_vehicle
AFTER DELETE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.delete_case_vehicle();