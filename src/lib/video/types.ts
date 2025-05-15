export interface ProcessingStatus {
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress?: number
  error?: string
}

export interface QueueItem {
  id: string
  user_id: string
  video_id: string
  status: ProcessingStatus['status']
  progress?: number
  error?: string
  created_at: string
  updated_at: string
}

export interface VideoMetadata {
  id: string
  title: string
  description: string
  duration: number
  thumbnailUrl: string
}
