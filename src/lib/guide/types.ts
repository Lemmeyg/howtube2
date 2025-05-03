export interface GuideConfig {
  transcription: string
  words: Array<{ text: string; start: number; end: number }>
  style?: 'default' | 'concise' | 'detailed'
  targetAudience?: 'beginner' | 'intermediate' | 'advanced'
  maxLength?: number
  includeTimestamps?: boolean
}

export interface Guide {
  title: string
  summary: string
  sections: Array<{
    title: string
    content: string
    timestamp?: {
      start: number
      end: number
    }
  }>
  keywords: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export interface GuideMetadata {
  id: string
  userId: string
  videoId: string
  title: string
  summary: string
  createdAt: string
  updatedAt: string
  keywords: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  status: 'pending' | 'generating' | 'completed' | 'error'
}
