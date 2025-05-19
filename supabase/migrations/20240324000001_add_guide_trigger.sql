-- Create function to handle guide generation
CREATE OR REPLACE FUNCTION handle_video_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger on status change to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Insert into video_guides table
    INSERT INTO video_guides (
      video_id,
      user_id,
      status,
      created_at,
      updated_at
    )
    VALUES (
      NEW.video_id,
      NEW.user_id,
      'generating',
      NOW(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS video_completion_trigger ON video_processing;
CREATE TRIGGER video_completion_trigger
  AFTER UPDATE ON video_processing
  FOR EACH ROW
  EXECUTE FUNCTION handle_video_completion(); 