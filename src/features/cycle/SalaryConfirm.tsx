import { useState, type FormEvent } from 'react'
import { AmountInput, Button, Card } from '../../components/ui'
import { confirmSalary } from '../../db/cycles'
import type { PayCycle } from '../../domain/types'
import { formatRange } from '../../lib/format'
import { paiseToInput, parseRupees } from '../../lib/money'

/** FR-1.3: when a new cycle opens, the carried-over salary is confirmed or edited. */
export function SalaryConfirm({ cycle }: { cycle: PayCycle }) {
  const [text, setText] = useState(() => paiseToInput(cycle.salary))
  const [error, setError] = useState<string>()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const salary = parseRupees(text)
    if (salary === null || salary === 0) {
      setError('Enter this cycle’s salary')
      return
    }
    await confirmSalary(cycle.id, salary)
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-3 p-4" aria-label="Confirm salary">
        <div>
          <p className="text-body font-medium">New pay cycle started</p>
          <p className="text-label text-text-secondary">
            {formatRange(cycle.start, cycle.end)} · confirm the salary you received
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <AmountInput
              label="Salary this cycle"
              hideLabel
              value={text}
              onChange={(v) => {
                setText(v)
                setError(undefined)
              }}
              error={error}
            />
          </div>
          <Button type="submit" variant="primary" className="h-9">
            Confirm
          </Button>
        </div>
      </form>
    </Card>
  )
}
