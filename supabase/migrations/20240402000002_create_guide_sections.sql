-- Create guide_sections table
CREATE TABLE guide_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id UUID NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  section_order INTEGER NOT NULL,
  timestamp JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_guide_sections_guide_id ON guide_sections(guide_id);
CREATE INDEX idx_guide_sections_order ON guide_sections(guide_id, section_order);

-- Add RLS policies
ALTER TABLE guide_sections ENABLE ROW LEVEL SECURITY;

-- Guide section policies
CREATE POLICY "Users can view sections of their guides"
  ON guide_sections
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM guides
    WHERE guides.id = guide_id
    AND guides.user_id = auth.uid()
  ));

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

-- Add service role policy
CREATE POLICY "Service role can manage guide sections"
  ON guide_sections
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER set_guide_sections_updated_at
  BEFORE UPDATE ON guide_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 