export const apiConfig = {
  assemblyAI: {
    apiKey: process.env.ASSEMBLYAI_API_KEY,
    baseUrl: 'https://api.assemblyai.com/v2',
    maxRetries: 3,
    retryDelay: 1000,
  },
  openAI: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4-turbo-preview',
    maxTokens: 4000,
    temperature: 0.7,
  },
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
} 