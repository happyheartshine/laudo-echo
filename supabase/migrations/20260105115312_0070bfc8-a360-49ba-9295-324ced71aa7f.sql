-- Fix infinite recursion on profiles RLS by using a SECURITY DEFINER helper function
CREATE OR REPLACE FUNCTION public.current_user_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- Drop the old recursive policy and create a new one
DROP POLICY IF EXISTS "Usuários podem ver perfis da mesma clínica" ON public.profiles;

CREATE POLICY "Usuários podem ver perfis da mesma clínica"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (clinic_id IS NOT NULL AND clinic_id = public.current_user_clinic_id())
);

-- Similarly fix clinics policy that also references profiles
DROP POLICY IF EXISTS "Usuários podem ver sua própria clínica" ON public.clinics;

CREATE POLICY "Usuários podem ver sua própria clínica"
ON public.clinics
FOR SELECT
TO authenticated
USING (id = public.current_user_clinic_id());

-- Fix update policy for clinics
DROP POLICY IF EXISTS "Gestores podem atualizar sua clínica" ON public.clinics;

-- Create helper function to check if user is gestor
CREATE OR REPLACE FUNCTION public.current_user_is_gestor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND cargo IN ('gestor', 'super_admin')
  )
$$;

CREATE POLICY "Gestores podem atualizar sua clínica"
ON public.clinics
FOR UPDATE
TO authenticated
USING (id = public.current_user_clinic_id() AND public.current_user_is_gestor())
WITH CHECK (id = public.current_user_clinic_id() AND public.current_user_is_gestor());