
-- Create table for diagnostic text templates (macros)
CREATE TABLE public.diagnostic_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  clinic_id UUID,
  category TEXT NOT NULL DEFAULT 'Geral',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.diagnostic_templates ENABLE ROW LEVEL SECURITY;

-- Users can view templates from their clinic
CREATE POLICY "Users can view their diagnostic templates"
ON public.diagnostic_templates
FOR SELECT
USING (user_id = auth.uid() OR (clinic_id IS NOT NULL AND clinic_id = current_user_clinic_id()));

-- Users can create their own templates
CREATE POLICY "Users can create diagnostic templates"
ON public.diagnostic_templates
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own templates
CREATE POLICY "Users can update their diagnostic templates"
ON public.diagnostic_templates
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own templates
CREATE POLICY "Users can delete their diagnostic templates"
ON public.diagnostic_templates
FOR DELETE
USING (user_id = auth.uid());

-- Add updated_at trigger
CREATE TRIGGER update_diagnostic_templates_updated_at
BEFORE UPDATE ON public.diagnostic_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_diagnostic_templates_user ON public.diagnostic_templates(user_id);
CREATE INDEX idx_diagnostic_templates_category ON public.diagnostic_templates(category);
