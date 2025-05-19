-- First add the column as nullable
ALTER TABLE video_transcriptions
ADD COLUMN video_url TEXT;

-- Update existing rows by joining with video_processing table
UPDATE video_transcriptions vt
SET video_url = vp.video_url
FROM video_processing vp
WHERE vt.processing_id = vp.id;

-- Now add the NOT NULL constraint
ALTER TABLE video_transcriptions
ALTER COLUMN video_url SET NOT NULL;

-- Add index for video_url
CREATE INDEX idx_video_transcriptions_video_url ON video_transcriptions(video_url);

-- Add unique constraint to prevent duplicate transcriptions for the same URL
ALTER TABLE video_transcriptions
ADD CONSTRAINT unique_video_url UNIQUE (video_url); 