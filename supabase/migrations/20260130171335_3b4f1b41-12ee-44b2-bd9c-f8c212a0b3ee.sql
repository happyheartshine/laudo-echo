-- Add service_id, patient_name, and owner_name to financial_transactions
ALTER TABLE public.financial_transactions
ADD COLUMN service_id uuid REFERENCES public.clinic_services(id) ON DELETE SET NULL,
ADD COLUMN patient_name text,
ADD COLUMN owner_name text;

-- Create index for faster lookups
CREATE INDEX idx_financial_transactions_service_id ON public.financial_transactions(service_id);