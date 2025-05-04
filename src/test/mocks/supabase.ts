export const createMockQueryBuilder = () => {
  return {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation(resolve => {
      resolve({ data: null, error: null })
      return Promise.resolve({ data: null, error: null })
    }),
    catch: jest.fn().mockImplementation(_reject => {
      return Promise.resolve({ data: null, error: null })
    }),
  }
}

export function createMockSupabaseClient(): {
  client: Record<string, unknown>
  queryBuilder: Record<string, unknown>
} {
  const queryBuilder: Record<string, unknown> = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    order: jest.fn().mockReturnThis(),
    then: jest.fn(),
    catch: jest.fn(),
    url: new URL('http://localhost'),
    headers: {},
  }
  const client: Record<string, unknown> = {
    from: jest.fn(() => queryBuilder),
    auth: {
      getSession: jest
        .fn()
        .mockResolvedValue({ data: { session: { user: { id: 'test-user-id' } } } }),
    },
  }
  return { client, queryBuilder }
}
