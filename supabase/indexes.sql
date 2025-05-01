-- Users table indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at);

-- Profiles table indexes
CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles (user_id);
CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles (username);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON profiles (created_at);

-- Guides table indexes
CREATE INDEX IF NOT EXISTS guides_author_id_idx ON guides (author_id);
CREATE INDEX IF NOT EXISTS guides_status_idx ON guides (status);
CREATE INDEX IF NOT EXISTS guides_created_at_idx ON guides (created_at);
CREATE INDEX IF NOT EXISTS guides_title_idx ON guides USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS guides_description_idx ON guides USING gin(to_tsvector('english', description));

-- Guide versions table indexes
CREATE INDEX IF NOT EXISTS guide_versions_guide_id_idx ON guide_versions (guide_id);
CREATE INDEX IF NOT EXISTS guide_versions_version_idx ON guide_versions (version);
CREATE INDEX IF NOT EXISTS guide_versions_created_at_idx ON guide_versions (created_at);

-- Tags table indexes
CREATE INDEX IF NOT EXISTS tags_name_idx ON tags (name);
CREATE INDEX IF NOT EXISTS tags_created_at_idx ON tags (created_at);

-- Guide tags table indexes
CREATE INDEX IF NOT EXISTS guide_tags_guide_id_idx ON guide_tags (guide_id);
CREATE INDEX IF NOT EXISTS guide_tags_tag_id_idx ON guide_tags (tag_id);
CREATE INDEX IF NOT EXISTS guide_tags_created_at_idx ON guide_tags (created_at);

-- Create indexes for performance optimization

-- Users table indexes
CREATE INDEX idx_users_email ON users(email);

-- Profiles table indexes
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_username ON profiles(username);

-- Guides table indexes
CREATE INDEX idx_guides_author_id ON guides(author_id);
CREATE INDEX idx_guides_status ON guides(status);

-- Guide versions table indexes
CREATE INDEX idx_guide_versions_guide_id ON guide_versions(guide_id);
CREATE INDEX idx_guide_versions_version ON guide_versions(version);

-- Guide tags table indexes
CREATE INDEX idx_guide_tags_guide_id ON guide_tags(guide_id);
CREATE INDEX idx_guide_tags_tag_id ON guide_tags(tag_id);

-- User interactions table indexes
CREATE INDEX idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX idx_user_interactions_guide_id ON user_interactions(guide_id);
CREATE INDEX idx_user_interactions_type ON user_interactions(interaction_type);
CREATE INDEX idx_user_interactions_created_at ON user_interactions(created_at);

-- Processing queue table indexes
CREATE INDEX idx_processing_queue_guide_id ON processing_queue(guide_id);
CREATE INDEX idx_processing_queue_status ON processing_queue(status);
CREATE INDEX idx_processing_queue_created_at ON processing_queue(created_at); 