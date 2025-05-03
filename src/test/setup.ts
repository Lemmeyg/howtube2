import { TextEncoder, TextDecoder } from 'util'

// Polyfill TextEncoder/TextDecoder
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder
}

// Mock Next.js modules
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}))

// Mock environment variables
process.env = {
  ...process.env,
  ASSEMBLYAI_API_KEY: 'test_assemblyai_key',
  OPENAI_API_KEY: 'test_openai_key',
  SUPABASE_URL: 'test_supabase_url',
  SUPABASE_ANON_KEY: 'test_supabase_key',
  NEXT_PUBLIC_SUPABASE_URL: 'test_supabase_url',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test_supabase_key',
}

// Suppress console during tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}

// Mock fetch API
const mockFetch = jest.fn()
const mockRequest = jest.fn()
const mockResponse = jest.fn()

// Set up global Web API mocks
Object.defineProperty(global, 'fetch', {
  value: mockFetch,
  writable: true,
  configurable: true,
})

Object.defineProperty(global, 'Request', {
  value: mockRequest,
  writable: true,
  configurable: true,
})

Object.defineProperty(global, 'Response', {
  value: mockResponse,
  writable: true,
  configurable: true,
})

// Mock Next.js headers
jest.mock('next/headers', () => ({
  cookies: () => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  }),
  headers: () => new Map(),
}))

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn(data => new mockResponse(JSON.stringify(data))),
    redirect: jest.fn(url => new mockResponse(null, { status: 302, headers: { Location: url } })),
  },
}))
