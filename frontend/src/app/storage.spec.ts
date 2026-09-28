import storage from './storage'

describe('storage', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('round-trips a value through window.localStorage', async () => {
    await storage.setItem('a-key', 'a-value')
    expect(window.localStorage.getItem('a-key')).toBe('a-value')
    await expect(storage.getItem('a-key')).resolves.toBe('a-value')
  })

  it('returns null for a key that was never set', async () => {
    await expect(storage.getItem('missing-key')).resolves.toBeNull()
  })

  it('removes a value', async () => {
    window.localStorage.setItem('a-key', 'a-value')
    await storage.removeItem('a-key')
    expect(window.localStorage.getItem('a-key')).toBeNull()
  })
})
