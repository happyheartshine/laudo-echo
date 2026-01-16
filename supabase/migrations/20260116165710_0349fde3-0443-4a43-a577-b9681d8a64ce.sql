-- Add partner_vet_id column to exams table for financial module tracking
ALTER TABLE public.exams 
ADD COLUMN IF NOT EXISTS partner_vet_id UUID REFERENCES public.partner_veterinarians(id) ON DELETE SET NULL;