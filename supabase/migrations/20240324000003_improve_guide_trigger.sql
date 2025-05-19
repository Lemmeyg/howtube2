-- Drop existing trigger and function
DROP TRIGGER IF EXISTS video_completion_trigger ON video_processing;
DROP FUNCTION IF EXISTS handle_video_completion();

-- Create improved function to handle guide generation
CREATE OR REPLACE FUNCTION handle_video_completion()
RETURNS TRIGGER AS $$
DECLARE
  guide_id UUID;
BEGIN
  -- Only trigger on status change to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- First check if a guide already exists
    SELECT id INTO guide_id
    FROM video_guides
    WHERE video_id = NEW.video_id
    LIMIT 1;

    -- Only create a new guide if one doesn't exist
    IF guide_id IS NULL THEN
      BEGIN
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
        )
        RETURNING id INTO guide_id;

        -- Log successful guide creation
        RAISE NOTICE 'Created new guide with ID: % for video: %', guide_id, NEW.video_id;
      EXCEPTION WHEN OTHERS THEN
        -- Log the error but don't fail the transaction
        RAISE WARNING 'Failed to create guide for video %: %', NEW.video_id, SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'Guide already exists with ID: % for video: %', guide_id, NEW.video_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER video_completion_trigger
  AFTER UPDATE ON video_processing
  FOR EACH ROW
  EXECUTE FUNCTION handle_video_completion(); 