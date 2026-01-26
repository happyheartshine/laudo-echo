-- Add is_default column to clinic_services
ALTER TABLE public.clinic_services ADD COLUMN is_default boolean NOT NULL DEFAULT false;

-- Create a function to ensure only one default service per clinic
CREATE OR REPLACE FUNCTION public.ensure_single_default_service()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If setting this service as default, unset others for the same clinic
  IF NEW.is_default = true THEN
    UPDATE public.clinic_services 
    SET is_default = false 
    WHERE partner_clinic_id = NEW.partner_clinic_id 
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to maintain single default
CREATE TRIGGER ensure_single_default_service_trigger
BEFORE INSERT OR UPDATE ON public.clinic_services
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_service();

-- Create a function to get default service price for a clinic
CREATE OR REPLACE FUNCTION public.get_default_service_price(clinic_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT price FROM public.clinic_services 
     WHERE partner_clinic_id = clinic_id AND is_default = true 
     LIMIT 1),
    0
  )
$$;