-- Drop existing foreign key constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'video_guides_video_id_fkey'
    ) THEN
        ALTER TABLE video_guides
        DROP CONSTRAINT video_guides_video_id_fkey;
    END IF;
END $$;

-- Add foreign key constraint to video_guides
ALTER TABLE video_guides
ADD CONSTRAINT video_guides_video_id_fkey
FOREIGN KEY (video_id)
REFERENCES video_processing(video_id)
ON DELETE SET NULL;

-- Add service role policy for video_guides
CREATE POLICY "Service role can manage guides"
ON video_guides
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Add service role policy for video_guide_sections
CREATE POLICY "Service role can manage guide sections"
ON video_guide_sections
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role'); 