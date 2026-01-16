-- Table for partner clinics (external clinics the cardiologist works with)
CREATE TABLE public.partner_clinics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  valor_exame DECIMAL(10,2) NOT NULL DEFAULT 0,
  responsavel TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for partner veterinarians
CREATE TABLE public.partner_veterinarians (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_clinic_id UUID NOT NULL REFERENCES public.partner_clinics(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_veterinarians ENABLE ROW LEVEL SECURITY;

-- RLS policies for partner_clinics
CREATE POLICY "Users can view their own partner clinics"
ON public.partner_clinics FOR SELECT
USING (user_id = auth.uid() OR clinic_id = current_user_clinic_id());

CREATE POLICY "Users can create their own partner clinics"
ON public.partner_clinics FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own partner clinics"
ON public.partner_clinics FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own partner clinics"
ON public.partner_clinics FOR DELETE
USING (user_id = auth.uid());

-- RLS policies for partner_veterinarians (via partner_clinic ownership)
CREATE POLICY "Users can view partner vets from their clinics"
ON public.partner_veterinarians FOR SELECT
USING (
  partner_clinic_id IN (
    SELECT id FROM public.partner_clinics 
    WHERE user_id = auth.uid() OR clinic_id = current_user_clinic_id()
  )
);

CREATE POLICY "Users can create partner vets in their clinics"
ON public.partner_veterinarians FOR INSERT
WITH CHECK (
  partner_clinic_id IN (
    SELECT id FROM public.partner_clinics WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update partner vets in their clinics"
ON public.partner_veterinarians FOR UPDATE
USING (
  partner_clinic_id IN (
    SELECT id FROM public.partner_clinics WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete partner vets in their clinics"
ON public.partner_veterinarians FOR DELETE
USING (
  partner_clinic_id IN (
    SELECT id FROM public.partner_clinics WHERE user_id = auth.uid()
  )
);

-- Triggers for updated_at
CREATE TRIGGER update_partner_clinics_updated_at
BEFORE UPDATE ON public.partner_clinics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_veterinarians_updated_at
BEFORE UPDATE ON public.partner_veterinarians
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();