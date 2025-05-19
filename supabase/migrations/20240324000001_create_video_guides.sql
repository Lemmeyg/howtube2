-- Create video_guides table
CREATE TABLE video_guides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL,
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