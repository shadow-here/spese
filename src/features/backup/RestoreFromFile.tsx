import { useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { parseBackup, restoreBackup, type Backup } from '../../db/backup'
import { todayISO } from '../../lib/date'
import { formatDate } from '../../lib/format'
import { allowSystemUi } from '../../lib/systemUi'

/**
 * "Restore from backup" button + file picker + validation error + confirm step.
 * Renders inline pieces; put it in a flex-wrap row — the error/confirm block is full width.
 * `replacing` = there is data on the device that a restore would overwrite.
 */
export function RestoreFromFile({
  label = 'Restore from file',
  size = 'md',
  replacing,
  onRestored,
}: {
  label?: string
  size?: 'md' | 'lg'
  replacing: boolean
  onRestored: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Backup>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function onFile(file: File | undefined) {
    setError(undefined)
    setPending(undefined)
    if (!file) return
    try {
      setPending(parseBackup(await file.text()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function restore() {
    if (!pending) return
    setBusy(true)
    try {
      await restoreBackup(pending)
      onRestored()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed — nothing was changed')
      setBusy(false)
    }
  }

  const from = pending && formatDate(todayISO(new Date(pending.exportedAt)), true)
  return (
    <>
      <Button
        size={size}
        onClick={() => {
          allowSystemUi() // the file picker isn't "leaving Spese"
          fileRef.current?.click()
        }}
        className={size === 'lg' ? 'w-full' : undefined}
      >
        {label}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-label="Backup file"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {error && (
        <p role="alert" className="w-full text-label text-negative">
          {error}
        </p>
      )}
      {pending && (
        <div role="group" aria-label="Confirm restore" className="flex w-full flex-col gap-2 rounded-card border border-border p-3">
          <p className="text-body">
            {replacing ? 'Replace everything on this device with the backup from ' : 'Restore the backup from '}
            <span className="text-text-primary">{from}</span> ({pending.data.transactions.length} transactions)?
            {replacing && ' This can’t be undone.'}
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setPending(undefined)}>Cancel</Button>
            <Button variant={replacing ? 'danger' : 'primary'} onClick={() => void restore()} disabled={busy} autoFocus>
              {replacing ? 'Replace and restore' : 'Restore'}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
