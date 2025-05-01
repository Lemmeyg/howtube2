-- Create video_guides table
CREATE TABLE video_guides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES video_processing(video_id) ON DELETE CASCADE,
  title TEXT,
  summary TEXT,
  keywords TEXT[],
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  status TEXT NOT NULL CHECK (status IN ('generating', 'completed', 'error')),
  error TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create video_guide_sections table
CREATE TABLE video_guide_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id UUID NOT NULL REFERENCES video_guides(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  section_order INTEGER NOT NULL,
  timestamp JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_video_guides_video_id ON video_guides(video_id);
CREATE INDEX idx_video_guides_user_id ON video_guides(user_id);
CREATE INDEX idx_video_guides_status ON video_guides(status);
CREATE INDEX idx_video_guide_sections_guide_id ON video_guide_sections(guide_id);

-- Add RLS policies
ALTER TABLE video_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_guide_sections ENABLE ROW LEVEL SECURITY;

-- Guide policies
CREATE POLICY "Users can view their own guides"
  ON video_guides
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own guides"
  ON video_guides
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own guides"
  ON video_guides
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own guides"
  ON video_guides
  FOR DELETE
  USING (auth.uid() = user_id);

-- Guide section policies
CREATE POLICY "Users can view sections of their guides"
  ON video_guide_sections
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM video_guides
    WHERE video_guides.id = guide_id
    AND video_guides.user_id = auth.uid()
  ));

CREATE POLICY "Users can create sections for their guides"
  ON video_guide_sections
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM video_guides
    WHERE video_guides.id = guide_id
    AND video_guides.user_id = auth.uid()
  ));

CREATE POLICY "Users can update sections of their guides"
  ON video_guide_sections
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM video_guides
    WHERE video_guides.id = guide_id
    AND video_guides.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete sections of their guides"
  ON video_guide_sections
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM video_guides
    WHERE video_guides.id = guide_id
    AND video_guides.user_id = auth.uid()
  ));

-- Add triggers for updated_at
CREATE TRIGGER set_video_guides_updated_at
  BEFORE UPDATE ON video_guides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_video_guide_sections_updated_at
  BEFORE UPDATE ON video_guide_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function for atomic guide updates
CREATE OR REPLACE FUNCTION update_guide(
  p_guide_id UUID,
  p_title TEXT,
  p_summary TEXT,
  p_keywords TEXT[],
  p_difficulty TEXT,
  p_sections JSONB[],
  p_status TEXT
) RETURNS void AS $$
BEGIN
  -- Update guide metadata
  UPDATE video_guides
  SET
    title = p_title,
    summary = p_summary,
    keywords = p_keywords,
    difficulty = p_difficulty,
    status = p_status,
    updated_at = now()
  WHERE id = p_guide_id;

  -- Delete existing sections
  DELETE FROM video_guide_sections
  WHERE guide_id = p_guide_id;

  -- Insert new sections
  INSERT INTO video_guide_sections (
    guide_id,
    title,
    content,
    section_order,
    timestamp
  )
  SELECT
    p_guide_id,
    (section->>'title')::TEXT,
    (section->>'content')::TEXT,
    row_number() OVER () - 1,
    CASE
      WHEN section->>'timestamp' IS NOT NULL
      THEN jsonb_build_object(
        'start', ((section->'timestamp')->>'start')::INTEGER,
        'end', ((section->'timestamp')->>'end')::INTEGER
      )
      ELSE NULL
    END
  FROM unnest(p_sections) section;
END;
$$ LANGUAGE plpgsql; 