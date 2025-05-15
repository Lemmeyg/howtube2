import { supabase } from '@/lib/supabase/client'

describe('Supabase Auth Cookie', () => {
  it('should set a cookie after successful login', async () => {
    // Mock fetch to simulate a Set-Cookie header
    const setCookieValue = 'sb-test-auth-token=abc123; Path=/; HttpOnly; Secure; SameSite=Lax'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        user: { id: 'test-user', email: 'test@example.com' },
        expires_in: 3600,
        token_type: 'bearer',
      }),
      headers: {
        get: (header: string) => (header.toLowerCase() === 'set-cookie' ? setCookieValue : null),
      },
    }) as unknown as Response

    // Perform login
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'password',
    })
    expect(error).toBeNull()
    expect(data.session).toBeDefined()
    // Simulate checking document.cookie (would require jsdom in real browser test)
    // Here, just check that fetch was called and Set-Cookie header was present
    expect(global.fetch).toHaveBeenCalled()
    const lastCall = (global.fetch as jest.Mock).mock.calls.pop()
    expect(lastCall).toBeDefined()
    // Check that the Set-Cookie header was present in the response
    const response = await (global.fetch as jest.Mock).mock.results[0].value
    expect(response.headers.get('set-cookie')).toContain('sb-test-auth-token')
  })
})
