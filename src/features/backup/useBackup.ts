import { useCallback } from 'react'
import { useToast } from '../../components/Toast'
import { backupFileName, createBackup, markBackedUp } from '../../db/backup'
import { saveTextFile } from '../../lib/platform'

/** One-tap backup export (feature 14). Only counts as backed up once the file is saved. */
export function useExportBackup() {
  const toast = useToast()
  return useCallback(async () => {
    try {
      const now = Date.now()
      const backup = await createBackup(undefined, now)
      const result = await saveTextFile(backupFileName(new Date(now)), JSON.stringify(backup))
      if (result === 'cancelled') return
      await markBackedUp(now)
      toast.show('Backup saved')
    } catch (err) {
      console.error(err)
      toast.show('Backup failed — try again')
    }
  }, [toast])
}
