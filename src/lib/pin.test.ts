import { fromBase64Url, hashPin, isValidPin, toBase64Url, verifyPin } from './pin'

describe('PIN', () => {
  it('accepts 4–6 digits only', () => {
    expect(['1234', '123456'].every(isValidPin)).toBe(true)
    expect(['123', '1234567', '12a4', '', ' 1234'].some(isValidPin)).toBe(false)
  })

  it('stores a salted hash, never the PIN, and verifies it', async () => {
    const stored = await hashPin('2580', 1000) // few iterations to keep the test fast
    expect(JSON.stringify(stored)).not.toContain('2580')
    expect(await verifyPin('2580', stored)).toBe(true)
    expect(await verifyPin('2581', stored)).toBe(false)
    expect(await verifyPin('abcd', stored)).toBe(false)
  })

  it('salts each hash differently', async () => {
    const a = await hashPin('2580', 1000)
    const b = await hashPin('2580', 1000)
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
  })

  it('round-trips base64url', () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255])
    expect([...fromBase64Url(toBase64Url(bytes))]).toEqual([...bytes])
    expect(toBase64Url(bytes)).not.toMatch(/[+/=]/)
  })
})
