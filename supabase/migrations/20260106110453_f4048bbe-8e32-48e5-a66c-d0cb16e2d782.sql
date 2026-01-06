-- Create storage bucket for exam images
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-images', 'exam-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for exam images bucket
CREATE POLICY "Authenticated users can upload exam images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'exam-images');

CREATE POLICY "Anyone can view exam images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'exam-images');

CREATE POLICY "Users can update their exam images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'exam-images');

CREATE POLICY "Users can delete their exam images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'exam-images');