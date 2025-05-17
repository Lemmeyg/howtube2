-- Add current_step column to video_processing table
ALTER TABLE video_processing
ADD COLUMN current_step TEXT;

-- Add index for current_step
CREATE INDEX idx_video_processing_current_step ON video_processing(current_step); 