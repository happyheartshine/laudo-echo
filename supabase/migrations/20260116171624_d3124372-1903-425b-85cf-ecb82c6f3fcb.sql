-- Add performing_vet_id column to exams table for tracking which team member performed the exam
ALTER TABLE public.exams 
ADD COLUMN IF NOT EXISTS performing_vet_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;