-- Create storage bucket for temporary PDF files sent via email
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-pdfs', 'email-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload PDFs
CREATE POLICY "Authenticated users can upload email PDFs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'email-pdfs' AND auth.role() = 'authenticated');

-- Policy to allow public read access for email links
CREATE POLICY "Public can read email PDFs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'email-pdfs');

-- Policy to allow authenticated users to delete their PDFs
CREATE POLICY "Authenticated users can delete email PDFs"
ON storage.objects
FOR DELETE
USING (bucket_id = 'email-pdfs' AND auth.role() = 'authenticated');