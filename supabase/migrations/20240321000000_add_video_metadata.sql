-- Create video metadata table
CREATE TABLE video_metadata (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL,
  thumbnail TEXT,
  formats JSONB NOT NULL,
  upload_date TEXT,
  uploader TEXT,
  uploader_url TEXT,
  view_count INTEGER,
  like_count INTEGER,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(video_id)
);

-- Create indexes
CREATE INDEX idx_video_metadata_video_id ON video_metadata(video_id);
CREATE INDEX idx_video_metadata_title ON video_metadata USING gin(to_tsvector('english', title));
CREATE INDEX idx_video_metadata_description ON video_metadata USING gin(to_tsvector('english', description));
CREATE INDEX idx_video_metadata_tags ON video_metadata USING gin(tags);

-- Enable RLS
ALTER TABLE video_metadata ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Public access to video metadata" ON video_metadata
  FOR SELECT USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_video_metadata_updated_at
  BEFORE UPDATE ON video_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 