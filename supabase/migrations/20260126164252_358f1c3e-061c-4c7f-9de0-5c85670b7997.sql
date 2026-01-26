-- Create clinic_services table for multiple service pricing
CREATE TABLE public.clinic_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_clinic_id UUID NOT NULL REFERENCES public.partner_clinics(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clinic_services ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (users can manage services for their own partner clinics)
CREATE POLICY "Users can view services from their partner clinics"
ON public.clinic_services
FOR SELECT
USING (
  partner_clinic_id IN (
    SELECT id FROM public.partner_clinics 
    WHERE user_id = auth.uid() OR clinic_id = current_user_clinic_id()
  )
);

CREATE POLICY "Users can create services for their partner clinics"
ON public.clinic_services
FOR INSERT
WITH CHECK (
  partner_clinic_id IN (
    SELECT id FROM public.partner_clinics WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update services for their partner clinics"
ON public.clinic_services
FOR UPDATE
USING (
  partner_clinic_id IN (
    SELECT id FROM public.partner_clinics WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete services for their partner clinics"
ON public.clinic_services
FOR DELETE
USING (
  partner_clinic_id IN (
    SELECT id FROM public.partner_clinics WHERE user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_clinic_services_partner_clinic_id ON public.clinic_services(partner_clinic_id);

-- Create trigger for updated_at
CREATE TRIGGER update_clinic_services_updated_at
BEFORE UPDATE ON public.clinic_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add service_id and exam_price columns to exams table for service tracking
ALTER TABLE public.exams 
ADD COLUMN service_id UUID REFERENCES public.clinic_services(id) ON DELETE SET NULL,
ADD COLUMN exam_price NUMERIC;