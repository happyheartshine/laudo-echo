-- Add logo_url column to partner_clinics table
ALTER TABLE public.partner_clinics ADD COLUMN logo_url text;

-- Create storage policy for clinic-logos bucket (if not exists)
DO $$
BEGIN
  -- Allow authenticated users to upload to clinic-logos bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload clinic logos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can upload clinic logos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'clinic-logos');
  END IF;
  
  -- Allow public read access to clinic logos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public can view clinic logos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public can view clinic logos"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'clinic-logos');
  END IF;
  
  -- Allow users to update their own uploads
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update clinic logos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can update clinic logos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'clinic-logos');
  END IF;
  
  -- Allow users to delete their own uploads
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete clinic logos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can delete clinic logos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'clinic-logos');
  END IF;
END $$;