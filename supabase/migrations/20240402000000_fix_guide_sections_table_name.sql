-- Rename video_guide_sections table to guide_sections
ALTER TABLE IF EXISTS video_guide_sections RENAME TO guide_sections;

-- Update index name
ALTER INDEX IF EXISTS idx_video_guide_sections_guide_id RENAME TO idx_guide_sections_guide_id;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view sections of their guides" ON guide_sections;
DROP POLICY IF EXISTS "Users can create sections for their guides" ON guide_sections;
DROP POLICY IF EXISTS "Users can update sections of their guides" ON guide_sections;
DROP POLICY IF EXISTS "Users can delete sections of their guides" ON guide_sections;
DROP POLICY IF EXISTS "Service role can manage guide sections" ON guide_sections;

-- Recreate policies with correct table name
CREATE POLICY "Anyone can view guide sections"
  ON guide_sections
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create sections for their guides"
  ON guide_sections
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM guides
    WHERE guides.id = guide_id
    AND guides.user_id = auth.uid()
  ));

CREATE POLICY "Users can update sections of their guides"
  ON guide_sections
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM guides
    WHERE guides.id = guide_id
    AND guides.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete sections of their guides"
  ON guide_sections
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM guides
    WHERE guides.id = guide_id
    AND guides.user_id = auth.uid()
  ));

-- Recreate service role policy
CREATE POLICY "Service role can manage guide sections"
  ON guide_sections
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Update trigger name
ALTER TRIGGER IF EXISTS set_video_guide_sections_updated_at ON guide_sections RENAME TO set_guide_sections_updated_at; 