-- Add clinic_name column to exams table for exam location tracking
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS clinic_name text;

-- Create index for faster filtering by clinic_name
CREATE INDEX IF NOT EXISTS idx_exams_clinic_name ON public.exams (clinic_name);

-- Add comment for documentation
COMMENT ON COLUMN public.exams.clinic_name IS 'Nome do local/clínica onde o exame foi realizado';