-- Add gender column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN sexo text DEFAULT 'masculino' CHECK (sexo IN ('masculino', 'feminino'));