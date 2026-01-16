-- Add telefone to partner_clinics table
ALTER TABLE public.partner_clinics
ADD COLUMN telefone text;

-- Add partner_clinic_id to exams for linking to partner clinics
ALTER TABLE public.exams
ADD COLUMN partner_clinic_id uuid REFERENCES public.partner_clinics(id) ON DELETE SET NULL;