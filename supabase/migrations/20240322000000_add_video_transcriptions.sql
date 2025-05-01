-- Create video_transcriptions table
CREATE TABLE video_transcriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES video_processing(video_id) ON DELETE CASCADE,
  transcription_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'error')),
  text TEXT,
  words JSONB,
  error TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_video_transcriptions_video_id ON video_transcriptions(video_id);
CREATE INDEX idx_video_transcriptions_user_id ON video_transcriptions(user_id);
CREATE INDEX idx_video_transcriptions_status ON video_transcriptions(status);

-- Add RLS policies
ALTER TABLE video_transcriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transcriptions"
  ON video_transcriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transcriptions"
  ON video_transcriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transcriptions"
  ON video_transcriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER set_video_transcriptions_updated_at
  BEFORE UPDATE ON video_transcriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 