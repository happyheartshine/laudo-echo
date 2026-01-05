-- Add new fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN crmv TEXT,
ADD COLUMN uf_crmv TEXT,
ADD COLUMN telefone TEXT,
ADD COLUMN especialidade TEXT;

-- Add telefone to clinics table
ALTER TABLE public.clinics
ADD COLUMN telefone TEXT;