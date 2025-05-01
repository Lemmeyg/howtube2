// Add Jest DOM matchers
import '@testing-library/jest-dom'

// Mock environment variables
process.env.ASSEMBLYAI_API_KEY = 'test_assemblyai_key'
process.env.OPENAI_API_KEY = 'test_openai_key'
process.env.SUPABASE_URL = 'test_supabase_url'
process.env.SUPABASE_ANON_KEY = 'test_supabase_key'

// Suppress console during tests
global.console = {
  ...console,
  // Uncomment to debug tests
  // log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
} 