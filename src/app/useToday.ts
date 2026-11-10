import { useEffect, useState } from 'react'
import { todayISO, type ISODate } from '../lib/date'

/**
 * Today's local date, kept fresh: re-checked every minute and whenever the app comes back
 * to the foreground (a home-screen PWA can sit suspended for days).
 */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const check = () => setToday(todayISO())
    const onVisible = () => document.visibilityState === 'visible' && check()
    const timer = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [])
  return today
}
