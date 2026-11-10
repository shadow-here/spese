import { useEffect, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check } from 'lucide-react'
import { CATEGORY_ICON_CHOICES, CategoryIcon } from '../../components/CategoryIcon'
import { useToast } from '../../components/Toast'
import { AmountInput, BottomSheet, Button, Input, Select } from '../../components/ui'
import { paiseToInput, parseRupees } from '../../lib/money'
import { addCategory, categoryUsage, removeCategory, updateCategory, type CategoryUsage } from '../../db/categories'
import { db } from '../../db/db'
import { CATEGORY_PALETTE, FALLBACK_CATEGORY_ID, MAX_CATEGORY_NAME, nextCategoryColour } from '../../domain/categories'
import type { Category } from '../../domain/types'
import { cn } from '../../lib/cn'

const COLOUR_NAMES = ['Blue', 'Orange', 'Aqua', 'Yellow', 'Magenta', 'Green', 'Violet', 'Red']
const ICON_LABEL = (icon: string) => icon.replace(/-/g, ' ')

/** Add or edit a spending category; remove it (moving its entries) from here too. */
export function CategorySheet({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Category }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? 'Edit category' : 'New category'}>
      {open && <CategoryForm key={editing?.id ?? 'new'} onClose={onClose} editing={editing} />}
    </BottomSheet>
  )
}

function CategoryForm({ onClose, editing }: { onClose: () => void; editing?: Category }) {
  const toast = useToast()
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const [name, setName] = useState(editing?.name ?? '')
  const [icon, setIcon] = useState(editing?.icon ?? 'shopping-cart')
  const [colour, setColour] = useState<string | undefined>(editing?.colour)
  const [budgetText, setBudgetText] = useState(editing?.monthlyLimit ? paiseToInput(editing.monthlyLimit) : '')
  const [error, setError] = useState<string>()
  const [removing, setRemoving] = useState<{ usage: CategoryUsage; moveTo: string }>()
  const [saving, setSaving] = useState(false)

  // A new category starts on the next free palette colour.
  useEffect(() => {
    if (!editing && categories && colour === undefined) setColour(nextCategoryColour(categories))
  }, [editing, categories, colour])

  async function submit(e: FormEvent) {
    e.preventDefault()
    // Empty budget = no budget; anything else must be a valid amount.
    const monthlyLimit = budgetText.trim() === '' ? null : parseRupees(budgetText)
    if (monthlyLimit === 0 || (budgetText.trim() !== '' && monthlyLimit === null)) {
      setError('Enter a budget amount, or leave it empty for none')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateCategory(editing.id, { name, icon, colour, monthlyLimit })
        toast.show('Category saved', { durationMs: 2000 })
      } else {
        const c = await addCategory({ name, icon, colour, monthlyLimit })
        toast.show(`${c.name} added`, { durationMs: 2000 })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setSaving(false)
    }
  }

  async function startRemove() {
    if (!editing) return
    setRemoving({ usage: await categoryUsage(editing.id), moveTo: FALLBACK_CATEGORY_ID })
  }

  async function confirmRemove() {
    if (!editing || !removing) return
    try {
      await removeCategory(editing.id, removing.moveTo)
      const target = categories?.find((c) => c.id === removing.moveTo)?.name
      const moved = removing.usage.transactions + removing.usage.fixedExpenses
      toast.show(moved ? `${editing.name} removed — entries moved to ${target}` : `${editing.name} removed`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove')
    }
  }

  const isFallback = editing?.id === FALLBACK_CATEGORY_ID
  const used = removing && removing.usage.transactions + removing.usage.fixedExpenses > 0

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Input
        label="Name"
        placeholder="Groceries, Rent, Pets…"
        value={name}
        onChange={(e) => (setName(e.target.value), setError(undefined))}
        maxLength={MAX_CATEGORY_NAME}
        error={error}
        hint={isFallback ? '“Other” can be renamed, but not removed — uncategorised entries land here.' : undefined}
        autoFocus
      />

      <div className="flex flex-col gap-1.5">
        <AmountInput label="Budget per pay cycle (optional)" value={budgetText} onChange={(v) => (setBudgetText(v), setError(undefined))} placeholder="No budget" />
        <p className="text-label text-text-secondary">You’ll get a heads-up at 80% and when you go over.</p>
      </div>

      <fieldset>
        <legend className="mb-2 text-label text-text-secondary">Icon</legend>
        <div role="radiogroup" aria-label="Icon" className="grid grid-cols-8 gap-1.5 sm:grid-cols-11">
          {CATEGORY_ICON_CHOICES.map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={icon === i}
              aria-label={ICON_LABEL(i)}
              onClick={() => setIcon(i)}
              className={cn(
                'flex aspect-square items-center justify-center rounded-control border transition-quick',
                icon === i ? 'border-accent bg-accent/15 text-text-primary' : 'border-border text-text-secondary hover:bg-surface-hover',
              )}
            >
              <CategoryIcon icon={i} />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-label text-text-secondary">Chart colour</legend>
        <div role="radiogroup" aria-label="Chart colour" className="flex flex-wrap gap-2">
          {CATEGORY_PALETTE.map((c, i) => {
            const selected = colour?.toUpperCase() === c
            const takenBy = categories?.filter((x) => x.id !== editing?.id && x.colour.toUpperCase() === c).map((x) => x.name)
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${COLOUR_NAMES[i]}${takenBy?.length ? `, also used by ${takenBy.join(', ')}` : ''}`}
                title={takenBy?.length ? `Also used by ${takenBy.join(', ')}` : COLOUR_NAMES[i]}
                onClick={() => setColour(c)}
                className={cn(
                  'flex size-8 items-center justify-center rounded-full transition-quick',
                  selected ? 'ring-2 ring-text-primary ring-offset-2 ring-offset-surface' : 'hover:scale-105',
                )}
                style={{ background: c }}
              >
                {/* Dark tick on yellow, white elsewhere — keeps it visible on every swatch. */}
                {selected && <Check size={16} strokeWidth={2} aria-hidden="true" color={i === 3 ? '#0B0B0B' : '#FFFFFF'} />}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-label text-text-secondary">Colours can repeat — charts always show the category’s name too.</p>
      </fieldset>

      {removing ? (
        <div role="group" aria-label="Confirm remove" className="flex flex-col gap-3 rounded-card border border-border p-3">
          {used ? (
            <>
              <p className="text-body">
                {editing!.name} is used by{' '}
                {[
                  removing.usage.transactions && `${removing.usage.transactions} ${removing.usage.transactions === 1 ? 'entry' : 'entries'}`,
                  removing.usage.fixedExpenses && `${removing.usage.fixedExpenses} fixed ${removing.usage.fixedExpenses === 1 ? 'expense' : 'expenses'}`,
                ]
                  .filter(Boolean)
                  .join(' and ')}
                . Move them to:
              </p>
              <Select label="Move to" value={removing.moveTo} onChange={(e) => setRemoving({ ...removing, moveTo: e.target.value })}>
                {categories
                  ?.filter((c) => c.id !== editing!.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </>
          ) : (
            <p className="text-body">Remove {editing!.name}? Nothing uses it.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setRemoving(undefined)}>Cancel</Button>
            <Button variant="danger" onClick={() => void confirmRemove()} autoFocus>
              {used ? 'Move and remove' : 'Remove'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {editing && !isFallback && (
            <Button variant="danger" size="lg" onClick={() => void startRemove()}>
              Remove
            </Button>
          )}
          <Button type="submit" variant="primary" size="lg" disabled={saving} className="flex-1">
            Save
          </Button>
        </div>
      )}
    </form>
  )
}
