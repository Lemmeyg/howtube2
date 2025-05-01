# Database Setup

This directory contains the database schema, migrations, and seed data for the HowTube application.

## Structure

```
supabase/
├── migrations/          # Database migrations
│   └── 00000000000000_initial_schema.sql  # Initial schema
├── seed/               # Seed data
│   └── initial_data.sql                    # Initial reference data
├── schema.sql          # Current schema (for reference)
└── indexes.sql         # Database indexes (for reference)
```

## Migrations

The migrations directory contains timestamped SQL files that track changes to the database schema. Each migration should be:
- Forward-only (no rollbacks)
- Idempotent where possible
- Wrapped in a transaction

To apply migrations:
1. Connect to your Supabase project
2. Run each migration file in order
3. Verify the changes in the Supabase dashboard

## Seed Data

The seed directory contains SQL files for populating the database with initial data:
- `initial_data.sql`: Contains static reference data (tags)
- User data and content should be created through the application

## Schema Overview

### Tables
- `users`: Extends Supabase auth.users
- `profiles`: User profile information
- `guides`: Main guide content
- `guide_versions`: Version history for guides
- `tags`: Content categorization
- `guide_tags`: Guide-tag relationships
- `user_interactions`: User engagement tracking
- `processing_queue`: Media processing queue

### Enums
- `guide_status`: draft, published, archived
- `interaction_type`: view, like, bookmark, share
- `processing_status`: pending, processing, completed, failed

### Security
- Row Level Security (RLS) enabled on all tables
- Policies enforce user-based access control
- Public access limited to published content

## Development

When making schema changes:
1. Create a new migration file with a timestamp prefix
2. Update schema.sql to reflect the current state
3. Test migrations on a development database
4. Update TypeScript types in src/types/supabase.ts 