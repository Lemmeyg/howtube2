-- Enable RLS if not already enabled
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_sections ENABLE ROW LEVEL SECURITY;

-- Service role policy for guides
drop policy if exists "Service role can manage guides" on guides;
CREATE POLICY "Service role can manage guides"
  ON guides
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Service role policy for guide_sections
drop policy if exists "Service role can manage guide sections" on guide_sections;
CREATE POLICY "Service role can manage guide sections"
  ON guide_sections
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- User RLS policies for guides
CREATE POLICY "Users can view their own guides"
  ON guides
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own guides"
  ON guides
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own guides"
  ON guides
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own guides"
  ON guides
  FOR DELETE
  USING (auth.uid() = user_id);

-- User RLS policies for guide_sections
CREATE POLICY "Users can view their own guide sections"
  ON guide_sections
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM guides
    WHERE guides.id = guide_id
    AND guides.user_id = auth.uid()
  ));

CREATE POLICY "Users can create their own guide sections"
  ON guide_sections
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM guides
    WHERE guides.id = guide_id
    AND guides.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own guide sections"
  ON guide_sections
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM guides
    WHERE guides.id = guide_id
    AND guides.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own guide sections"
  ON guide_sections
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM guides
    WHERE guides.id = guide_id
    AND guides.user_id = auth.uid()
  ));

-- Trigger to create a guide when video_processing is completed
CREATE OR REPLACE FUNCTION handle_video_completion()
RETURNS TRIGGER AS $$
DECLARE
  guide_id UUID;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT id INTO guide_id FROM guides WHERE video_id = NEW.video_id LIMIT 1;
    IF guide_id IS NULL THEN
      BEGIN
        INSERT INTO guides (
          video_id,
          user_id,
          status,
          created_at,
          updated_at
        )
        VALUES (
          NEW.video_id,
          NEW.user_id,
          'generating',
          NOW(),
          NOW()
        )
        RETURNING id INTO guide_id;
        RAISE NOTICE 'Created new guide with ID: % for video: %', guide_id, NEW.video_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to create guide for video %: %', NEW.video_id, SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'Guide already exists with ID: % for video: %', guide_id, NEW.video_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS video_completion_trigger ON video_processing;
CREATE TRIGGER video_completion_trigger
  AFTER UPDATE ON video_processing
  FOR EACH ROW
  EXECUTE FUNCTION handle_video_completion(); 