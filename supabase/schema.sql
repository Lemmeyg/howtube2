-- Create guide_status enum
CREATE TYPE guide_status AS ENUM ('draft', 'published', 'archived');

-- Create interaction_type enum
CREATE TYPE interaction_type AS ENUM ('view', 'like', 'bookmark', 'share');

-- Create processing_status enum
CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create profiles table
CREATE TABLE profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create guides table
CREATE TABLE guides (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  author_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status guide_status DEFAULT 'draft' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create guide_versions table
CREATE TABLE guide_versions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  guide_id UUID REFERENCES guides(id) ON DELETE CASCADE NOT NULL,
  version INTEGER NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(guide_id, version)
);

-- Create tags table
CREATE TABLE tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create guide_tags junction table
CREATE TABLE guide_tags (
  guide_id UUID REFERENCES guides(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (guide_id, tag_id)
);

-- Create user_interactions table
CREATE TABLE user_interactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  guide_id UUID REFERENCES guides(id) ON DELETE CASCADE NOT NULL,
  interaction_type interaction_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, guide_id, interaction_type)
);

-- Create processing_queue table
CREATE TABLE processing_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  guide_id UUID REFERENCES guides(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  status processing_status DEFAULT 'pending' NOT NULL,
  error_message TEXT,
  result_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Set up Row Level Security (RLS)

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Guides policies
CREATE POLICY "Published guides are viewable by everyone" ON guides
  FOR SELECT USING (status = 'published');

CREATE POLICY "Users can view their own guides" ON guides
  FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Users can update their own guides" ON guides
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can insert their own guides" ON guides
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete their own guides" ON guides
  FOR DELETE USING (auth.uid() = author_id);

-- Guide versions policies
CREATE POLICY "Published guide versions are viewable by everyone" ON guide_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM guides
      WHERE guides.id = guide_versions.guide_id
      AND guides.status = 'published'
    )
  );

CREATE POLICY "Users can view versions of their own guides" ON guide_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM guides
      WHERE guides.id = guide_versions.guide_id
      AND guides.author_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert versions to their own guides" ON guide_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM guides
      WHERE guides.id = guide_versions.guide_id
      AND guides.author_id = auth.uid()
    )
  );

-- Tags policies
CREATE POLICY "Tags are viewable by everyone" ON tags
  FOR SELECT USING (true);

CREATE POLICY "Only authenticated users can create tags" ON tags
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Guide tags policies
CREATE POLICY "Guide tags are viewable by everyone" ON guide_tags
  FOR SELECT USING (true);

CREATE POLICY "Users can tag their own guides" ON guide_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM guides
      WHERE guides.id = guide_tags.guide_id
      AND guides.author_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove tags from their own guides" ON guide_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM guides
      WHERE guides.id = guide_tags.guide_id
      AND guides.author_id = auth.uid()
    )
  );

-- User interactions policies
CREATE POLICY "Users can view their own interactions" ON user_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own interactions" ON user_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interactions" ON user_interactions
  FOR DELETE USING (auth.uid() = user_id);

-- Processing queue policies
CREATE POLICY "Users can view processing queue for their guides" ON processing_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM guides
      WHERE guides.id = processing_queue.guide_id
      AND guides.author_id = auth.uid()
    )
  );

CREATE POLICY "Users can add to processing queue for their guides" ON processing_queue
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM guides
      WHERE guides.id = processing_queue.guide_id
      AND guides.author_id = auth.uid()
    )
  );

-- Create functions and triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guides_updated_at
  BEFORE UPDATE ON guides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guide_versions_updated_at
  BEFORE UPDATE ON guide_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_queue_updated_at
  BEFORE UPDATE ON processing_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 