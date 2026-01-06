-- Garantir que o bucket exam-images tem as políticas corretas de acesso
-- (as políticas já devem existir, mas vamos garantir)

-- Política para leitura pública (já deve existir)
DO $$
BEGIN
  -- Verificar se a política já existe antes de criar
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public read access for exam-images'
  ) THEN
    EXECUTE 'CREATE POLICY "Public read access for exam-images" ON storage.objects FOR SELECT USING (bucket_id = ''exam-images'')';
  END IF;
END $$;