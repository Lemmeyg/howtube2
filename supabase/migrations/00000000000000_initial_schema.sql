-- Initial schema migration

BEGIN;

-- Create enums
CREATE TYPE guide_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE interaction_type AS ENUM ('view', 'like', 'bookmark', 'share');
CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE users (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT UNIQUE,
  full_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE guides (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  author_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status guide_status DEFAULT 'draft' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE guide_versions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  guide_id UUID REFERENCES guides(id) ON DELETE CASCADE NOT NULL,
  version INTEGER NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(guide_id, version)
);

CREATE TABLE tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE guide_tags (
  guide_id UUID REFERENCES guides(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (guide_id, tag_id)
);

CREATE TABLE user_interactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  guide_id UUID REFERENCES guides(id) ON DELETE CASCADE NOT NULL,
  interaction_type interaction_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, guide_id, interaction_type)
);

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

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_created_at ON profiles(created_at);

CREATE INDEX idx_guides_author_id ON guides(author_id);
CREATE INDEX idx_guides_status ON guides(status);
CREATE INDEX idx_guides_created_at ON guides(created_at);
CREATE INDEX idx_guides_title_tsvector ON guides USING gin(to_tsvector('english', title));
CREATE INDEX idx_guides_description_tsvector ON guides USING gin(to_tsvector('english', coalesce(description, '')));

CREATE INDEX idx_guide_versions_guide_id ON guide_versions(guide_id);
CREATE INDEX idx_guide_versions_version ON guide_versions(version);
CREATE INDEX idx_guide_versions_created_at ON guide_versions(created_at);

CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_tags_created_at ON tags(created_at);

CREATE INDEX idx_guide_tags_guide_id ON guide_tags(guide_id);
CREATE INDEX idx_guide_tags_tag_id ON guide_tags(tag_id);
CREATE INDEX idx_guide_tags_created_at ON guide_tags(created_at);

CREATE INDEX idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX idx_user_interactions_guide_id ON user_interactions(guide_id);
CREATE INDEX idx_user_interactions_type ON user_interactions(interaction_type);
CREATE INDEX idx_user_interactions_created_at ON user_interactions(created_at);

CREATE INDEX idx_processing_queue_guide_id ON processing_queue(guide_id);
CREATE INDEX idx_processing_queue_status ON processing_queue(status);
CREATE INDEX idx_processing_queue_created_at ON processing_queue(created_at);

-- Create functions and triggers
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

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

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

CREATE POLICY "Tags are viewable by everyone" ON tags
  FOR SELECT USING (true);

CREATE POLICY "Only authenticated users can create tags" ON tags
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

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

CREATE POLICY "Users can view their own interactions" ON user_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own interactions" ON user_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interactions" ON user_interactions
  FOR DELETE USING (auth.uid() = user_id);

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

COMMIT; 