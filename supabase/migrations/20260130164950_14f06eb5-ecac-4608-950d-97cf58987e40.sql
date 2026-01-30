-- Tabela para lançamentos financeiros manuais (separados dos exames)
CREATE TABLE public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  clinic_id UUID REFERENCES public.clinics(id),
  partner_clinic_id UUID REFERENCES public.partner_clinics(id),
  exam_id UUID REFERENCES public.exams(id), -- NULL para lançamentos manuais
  description TEXT NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'a_receber', -- 'a_receber', 'pago', 'cancelado'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own financial transactions" 
ON public.financial_transactions 
FOR SELECT 
USING (user_id = auth.uid() OR (clinic_id IS NOT NULL AND clinic_id = current_user_clinic_id()));

CREATE POLICY "Users can create their own financial transactions" 
ON public.financial_transactions 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own financial transactions" 
ON public.financial_transactions 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own financial transactions" 
ON public.financial_transactions 
FOR DELETE 
USING (user_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_financial_transactions_updated_at
BEFORE UPDATE ON public.financial_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();