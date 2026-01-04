-- Enum para cargos
CREATE TYPE public.user_role AS ENUM ('super_admin', 'gestor', 'veterinario');

-- Tabela de clínicas
CREATE TABLE public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_fantasia TEXT NOT NULL,
  endereco TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  cargo public.user_role NOT NULL DEFAULT 'veterinario',
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de convites de equipe
CREATE TABLE public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  cargo public.user_role NOT NULL DEFAULT 'veterinario',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_clinics_updated_at
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar perfil automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  invite_record RECORD;
  new_clinic_id UUID;
BEGIN
  -- Verificar se existe um convite pendente para este email
  SELECT * INTO invite_record FROM public.team_invites 
  WHERE email = NEW.email AND accepted = false 
  LIMIT 1;
  
  IF invite_record.id IS NOT NULL THEN
    -- Aceitar convite e usar a clínica do convite
    INSERT INTO public.profiles (user_id, nome, cargo, clinic_id)
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email),
      invite_record.cargo,
      invite_record.clinic_id
    );
    
    -- Marcar convite como aceito
    UPDATE public.team_invites SET accepted = true WHERE id = invite_record.id;
  ELSE
    -- Novo usuário sem convite - criar como Gestor com nova clínica
    INSERT INTO public.clinics (nome_fantasia) VALUES ('Minha Clínica') RETURNING id INTO new_clinic_id;
    
    INSERT INTO public.profiles (user_id, nome, cargo, clinic_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email),
      'gestor',
      new_clinic_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para criar perfil após signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies para clinics
CREATE POLICY "Usuários podem ver sua própria clínica"
  ON public.clinics FOR SELECT
  USING (
    id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Gestores podem atualizar sua clínica"
  ON public.clinics FOR UPDATE
  USING (
    id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE user_id = auth.uid() AND cargo IN ('gestor', 'super_admin')
    )
  );

-- RLS Policies para profiles
CREATE POLICY "Usuários podem ver perfis da mesma clínica"
  ON public.profiles FOR SELECT
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policies para team_invites
CREATE POLICY "Gestores podem ver convites da sua clínica"
  ON public.team_invites FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE user_id = auth.uid() AND cargo IN ('gestor', 'super_admin')
    )
  );

CREATE POLICY "Gestores podem criar convites"
  ON public.team_invites FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE user_id = auth.uid() AND cargo IN ('gestor', 'super_admin')
    )
  );

CREATE POLICY "Gestores podem deletar convites"
  ON public.team_invites FOR DELETE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE user_id = auth.uid() AND cargo IN ('gestor', 'super_admin')
    )
  );

-- Criar bucket para logos das clínicas
INSERT INTO storage.buckets (id, name, public) VALUES ('clinic-logos', 'clinic-logos', true);

-- Políticas de storage para logos
CREATE POLICY "Logos são públicas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'clinic-logos');

CREATE POLICY "Gestores podem fazer upload de logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'clinic-logos' AND
    auth.uid() IN (
      SELECT user_id FROM public.profiles WHERE cargo IN ('gestor', 'super_admin')
    )
  );

CREATE POLICY "Gestores podem atualizar logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'clinic-logos' AND
    auth.uid() IN (
      SELECT user_id FROM public.profiles WHERE cargo IN ('gestor', 'super_admin')
    )
  );

CREATE POLICY "Gestores podem deletar logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'clinic-logos' AND
    auth.uid() IN (
      SELECT user_id FROM public.profiles WHERE cargo IN ('gestor', 'super_admin')
    )
  );