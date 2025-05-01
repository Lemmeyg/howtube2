-- Initial seed data

BEGIN;

-- Insert some initial tags
INSERT INTO tags (name, description) VALUES
  ('javascript', 'JavaScript programming language tutorials'),
  ('react', 'React.js framework tutorials'),
  ('nextjs', 'Next.js framework tutorials'),
  ('typescript', 'TypeScript programming tutorials'),
  ('database', 'Database related guides'),
  ('frontend', 'Frontend development tutorials'),
  ('backend', 'Backend development tutorials'),
  ('testing', 'Testing and QA tutorials'),
  ('deployment', 'Deployment and DevOps guides'),
  ('security', 'Security best practices');

-- Note: Users and actual content will be created through the application
-- This seed file only contains static reference data

COMMIT; 