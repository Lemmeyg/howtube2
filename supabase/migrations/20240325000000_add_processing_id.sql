-- Add processing_id column to video_transcriptions table
ALTER TABLE video_transcriptions
ADD COLUMN processing_id UUID REFERENCES video_processing(id) ON DELETE CASCADE;

-- Add index for processing_id
CREATE INDEX idx_video_transcriptions_processing_id ON video_transcriptions(processing_id); 