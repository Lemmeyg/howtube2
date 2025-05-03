import OpenAI from 'openai'
import { AssemblyAI } from '@/lib/transcription/assemblyai'

export const createMockOpenAI = () => {
  return {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Test Guide',
                  summary: 'Test Summary',
                  sections: [
                    {
                      title: 'Section 1',
                      content: 'Section 1 content',
                    },
                  ],
                  keywords: ['test', 'guide'],
                  difficulty: 'intermediate',
                }),
              },
            },
          ],
        }),
      },
    },
  } as unknown as OpenAI
}

export const createMockAssemblyAI = () => {
  return {
    transcribe: jest.fn().mockResolvedValue({
      id: 'test-transcription-id',
      text: 'Test transcription',
      words: [
        { text: 'Test', start: 0, end: 1 },
        { text: 'transcription', start: 1, end: 2 },
      ],
      status: 'completed',
    }),
  } as unknown as AssemblyAI
}
