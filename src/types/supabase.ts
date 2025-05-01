export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          created_at: string
          updated_at: string
        }
      }
      profiles: {
        Row: {
          id: string
          user_id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
      }
      guides: {
        Row: {
          id: string
          title: string
          description: string | null
          author_id: string
          status: Database['public']['Enums']['guide_status']
          created_at: string
          updated_at: string
        }
      }
      guide_versions: {
        Row: {
          id: string
          guide_id: string
          version: number
          content: {
            sections: Array<{
              title: string
              content: string
              timestamp?: number
              resources?: Array<{
                type: 'link' | 'file' | 'note'
                title: string
                url?: string
                content?: string
              }>
            }>
            metadata?: {
              videoUrl?: string
              transcript?: string
              summary?: string
              keywords?: string[]
            }
          }
          created_at: string
          updated_at: string
        }
      }
      tags: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
      }
      guide_tags: {
        Row: {
          guide_id: string
          tag_id: string
          created_at: string
        }
      }
      user_interactions: {
        Row: {
          id: string
          user_id: string
          guide_id: string
          interaction_type: Database['public']['Enums']['interaction_type']
          created_at: string
        }
      }
      processing_queue: {
        Row: {
          id: string
          guide_id: string
          file_url: string
          file_type: string
          status: Database['public']['Enums']['processing_status']
          error_message: string | null
          result_url: string | null
          created_at: string
          updated_at: string
        }
      }
    }
    Enums: {
      guide_status: 'draft' | 'published' | 'archived'
      interaction_type: 'view' | 'like' | 'bookmark' | 'share'
      processing_status: 'pending' | 'processing' | 'completed' | 'failed'
    }
  }
}
