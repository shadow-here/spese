import { useLiveQuery } from 'dexie-react-hooks'
import { Archive } from 'lucide-react'
import { Button, Card } from '../../components/ui'
import { backupOverdue } from '../../db/backup'
import { db } from '../../db/db'
import { useExportBackup } from './useBackup'

/** Edge case: remind to back up if none in 14 days (deleting the home-screen app deletes the data). */
export function BackupReminder() {
  const user = useLiveQuery(() => db.users.get('me'), [])
  const exportBackup = useExportBackup()
  if (!user || !backupOverdue(user)) return null
  return (
    <Card className="flex items-center gap-3 p-4">
      <Archive size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-text-secondary" />
      <p className="flex-1 text-body text-text-secondary">
        {user.lastBackupAt ? 'No backup in over 2 weeks.' : 'You haven’t backed up yet.'} Your data only lives on this device.
      </p>
      <Button onClick={() => void exportBackup()}>Back up</Button>
    </Card>
  )
}
