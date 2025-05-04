export interface GuideConfig {
  transcription: string
  words: Array<{ text: string; start: number; end: number }>
  style?: 'default' | 'concise' | 'detailed'
  targetAudience?: 'beginner' | 'intermediate' | 'advanced'
  maxLength?: number
  includeTimestamps?: boolean
}

export interface GuideSection {
  id: string
  title: string
  content: string
  timestamp?: {
    start: number
    end: number
  }
  images?: string[]
  order: number
}

export interface Guide {
  id?: string
  title: string
  summary: string
  sections: GuideSection[]
  keywords: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  metadata?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
  status?: 'pending' | 'generating' | 'completed' | 'error'
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
