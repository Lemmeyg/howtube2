-- Add missing columns to video_processing table
ALTER TABLE video_processing
ADD COLUMN IF NOT EXISTS step TEXT;

-- Add missing columns to video_transcriptions table
ALTER TABLE video_transcriptions
ADD COLUMN IF NOT EXISTS words JSONB;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_video_processing_step ON video_processing(step);
CREATE INDEX IF NOT EXISTS idx_video_transcriptions_words ON video_transcriptions USING GIN (words); 