-- Create exam-reports bucket for WhatsApp PDF sharing
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-reports', 'exam-reports', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload PDFs to exam-reports bucket
CREATE POLICY "Authenticated users can upload exam reports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'exam-reports');

-- Allow public read access to exam reports (needed for WhatsApp sharing)
CREATE POLICY "Public can read exam reports"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'exam-reports');