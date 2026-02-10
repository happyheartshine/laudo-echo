
-- Add active column to partner_clinics
ALTER TABLE public.partner_clinics ADD COLUMN active boolean NOT NULL DEFAULT true;

-- Add active column to partner_veterinarians
ALTER TABLE public.partner_veterinarians ADD COLUMN active boolean NOT NULL DEFAULT true;
