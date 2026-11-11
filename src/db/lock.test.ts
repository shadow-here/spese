import 'fake-indexeddb/auto'
import { createBackup } from './backup'
import { onboard } from './cycles'
import { TrackerDB } from './db'
import { changePin, checkPin, disableLock, enableLock, getLock, setBiometric } from './lock'

let database: TrackerDB
beforeEach(async () => {
  database = new TrackerDB(`lock-test-${Math.random()}`)
  await database.open()
  await onboard({ salary: 100, payDay: 1, today: '2026-11-10' }, database)
})
afterEach(async () => {
  await database.delete()
})

const FAST = 1000 // PBKDF2 iterations for tests

describe('app lock storage', () => {
  it('turns on, checks, changes and turns off with the PIN', async () => {
    expect(await getLock(database)).toBeUndefined()
    await enableLock('2580', database, FAST)
    expect(await checkPin('2580', database)).toBe(true)
    expect(await checkPin('0000', database)).toBe(false)

    expect(await changePin('0000', '1470', database, FAST)).toBe(false) // wrong current PIN
    expect(await changePin('2580', '1470', database, FAST)).toBe(true)
    expect(await checkPin('1470', database)).toBe(true)

    expect(await disableLock('2580', database)).toBe(false)
    expect(await disableLock('1470', database)).toBe(true)
    expect(await getLock(database)).toBeUndefined()
  })

  it('keeps Face ID across a PIN change', async () => {
    await enableLock('2580', database, FAST)
    await setBiometric('cred-123', database)
    await changePin('2580', '1470', database, FAST)
    expect((await getLock(database))!.credentialId).toBe('cred-123')
  })

  it('is never written into a backup', async () => {
    await enableLock('2580', database, FAST)
    await database.users.update('me', { reminder: { time: '21:00', endpoint: 'https://push.example/x' } })
    const backup = await createBackup(database)
    expect(backup.data.users[0]).not.toHaveProperty('lock')
    expect(backup.data.users[0]).not.toHaveProperty('reminder')
  })
})
