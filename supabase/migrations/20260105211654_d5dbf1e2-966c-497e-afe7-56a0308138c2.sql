-- Tabela para armazenar exames/laudos
CREATE TABLE public.exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  owner_name TEXT,
  species TEXT,
  breed TEXT,
  exam_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: usuários podem ver exames da sua clínica
CREATE POLICY "Usuários podem ver exames da sua clínica"
ON public.exams
FOR SELECT
USING (
  user_id = auth.uid() 
  OR (clinic_id IS NOT NULL AND clinic_id = current_user_clinic_id())
);

-- Usuários podem criar exames
CREATE POLICY "Usuários podem criar exames"
ON public.exams
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Usuários podem atualizar seus próprios exames
CREATE POLICY "Usuários podem atualizar seus exames"
ON public.exams
FOR UPDATE
USING (user_id = auth.uid());

-- Usuários podem deletar seus próprios exames
CREATE POLICY "Usuários podem deletar seus exames"
ON public.exams
FOR DELETE
USING (user_id = auth.uid());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_exams_user_id ON public.exams(user_id);
CREATE INDEX idx_exams_clinic_id ON public.exams(clinic_id);
CREATE INDEX idx_exams_patient_name ON public.exams(patient_name);
CREATE INDEX idx_exams_exam_date ON public.exams(exam_date DESC);