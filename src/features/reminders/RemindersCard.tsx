import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useToast } from '../../components/Toast'
import { Button, Card } from '../../components/ui'
import { db } from '../../db/db'
import { changeReminderTime, disableReminders, enableReminders, reminderSupport, sendTestReminder } from '../../lib/push'

const MESSAGES = {
  'not-configured': 'Daily reminders need the Spese push server, which isn’t set up yet (steps in docs/PUSH.md).',
  unsupported: 'This browser can’t receive reminders.',
  'install-first': 'On iPhone, add Spese to your Home Screen first (Share → Add to Home Screen), then turn reminders on from there.',
  blocked: 'Notifications are blocked for Spese — allow them in your phone’s settings, then come back.',
} as const

/**
 * Settings → Reminders (PRD #23/#24): one notification a day at a time you pick — rent or a
 * bonus due today, or a nudge to log. The message is written on the phone; the push server only
 * knows when to knock.
 */
export function RemindersCard() {
  const toast = useToast()
  const user = useLiveQuery(() => db.users.get('me'), [])
  const [time, setTime] = useState<string>()
  const [busy, setBusy] = useState(false)
  if (!user) return null
  const support = reminderSupport()
  const on = Boolean(user.reminder)
  const shownTime = time ?? user.reminder?.time ?? '21:00'

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true)
    try {
      await action()
      toast.show(success)
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Reminders">
      <div className="flex flex-col gap-3 p-4">
        <p className="text-body text-text-secondary">
          One notification a day: rent or a bonus due today, or a nudge to log what you spent.{' '}
          <span className="text-label">The push server only knows this phone’s address and the time — never your numbers.</span>
        </p>

        {support !== 'ok' && !on ? (
          <p className="text-label text-text-secondary">{MESSAGES[support]}</p>
        ) : (
          <>
            <label className="flex items-center justify-between gap-3 text-body">
              Remind me daily at
              <input
                type="time"
                value={shownTime}
                onChange={(e) => setTime(e.target.value)}
                className="tnum h-9 rounded-control border border-border bg-surface px-2 text-body text-text-primary [color-scheme:dark] focus-visible:border-accent focus-visible:outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {on ? (
                <>
                  <Button
                    variant="primary"
                    disabled={busy || shownTime === user.reminder?.time}
                    onClick={() => void run(() => changeReminderTime(shownTime), `Reminders moved to ${shownTime}`)}
                  >
                    Save time
                  </Button>
                  <Button disabled={busy} onClick={() => void run(sendTestReminder, 'Test sent — it should arrive in a few seconds')}>
                    Send a test
                  </Button>
                  <Button variant="danger" disabled={busy} onClick={() => void run(disableReminders, 'Reminders off')}>
                    Turn off
                  </Button>
                </>
              ) : (
                <Button variant="primary" disabled={busy} onClick={() => void run(() => enableReminders(shownTime), `Reminders on — daily at ${shownTime}`)}>
                  Turn on reminders
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
