-- Add video processing status enum
ALTER TYPE processing_status ADD VALUE IF NOT EXISTS 'downloading';

-- Create video processing table
CREATE TABLE video_processing (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  video_id TEXT NOT NULL,
  url TEXT NOT NULL,
  status processing_status DEFAULT 'pending' NOT NULL,
  progress NUMERIC(5,2) DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  speed TEXT,
  eta TEXT,
  size TEXT,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(video_id)
);

-- Create indexes
CREATE INDEX idx_video_processing_user_id ON video_processing(user_id);
CREATE INDEX idx_video_processing_video_id ON video_processing(video_id);
CREATE INDEX idx_video_processing_status ON video_processing(status);
CREATE INDEX idx_video_processing_created_at ON video_processing(created_at);

-- Enable RLS
ALTER TABLE video_processing ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own video processing records" ON video_processing
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own video processing records" ON video_processing
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own video processing records" ON video_processing
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own video processing records" ON video_processing
  FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_video_processing_updated_at
  BEFORE UPDATE ON video_processing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 