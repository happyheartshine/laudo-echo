-- Add owner contact columns to exams table
ALTER TABLE public.exams
ADD COLUMN owner_phone text,
ADD COLUMN owner_email text;