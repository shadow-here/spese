import { useState } from 'react'
import { ShoppingBag, Utensils, Wifi } from 'lucide-react'
import { Button, Card, Chip, Input, ListRow, Tag } from '../components/ui'

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other']

/** Dev reference page for the primitives (open #/ui). Not linked from the nav. */
export function UiKitPage() {
  const [cat, setCat] = useState('Food')
  return (
    <div className="flex flex-col gap-6">
      <Card className="p-4">
        <p className="text-label text-text-secondary">Remaining this cycle</p>
        <p className="tnum text-balance">₹42,350.00</p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-hover">
          <div className="h-full w-[62%] bg-text-primary" />
        </div>
        <p className="mt-2 text-label text-text-secondary">62% of salary left · 18 days left</p>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary">Primary</Button>
        <Button>Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Delete</Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Small</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Amount" placeholder="0" inputMode="decimal" className="tnum" />
        <Input label="Note" placeholder="Optional" hint="Shown in the transaction list" />
        <Input label="Pay day" defaultValue="32" error="Pay day must be between 1 and 31" />
      </div>

      <Card title="Recent transactions" action={<Button variant="ghost" size="sm">View all</Button>}>
        <ListRow leading={<Utensils size={16} strokeWidth={1.5} />} title="Lunch" subtitle="Food · Today" trailing={<span className="tnum">−₹240.00</span>} onClick={() => {}} />
        <ListRow
          leading={<Wifi size={16} strokeWidth={1.5} />}
          title={
            <span className="flex items-center gap-2">
              WiFi <Tag>Auto</Tag>
            </span>
          }
          subtitle="Bills · 5 Nov"
          trailing={<span className="tnum">−₹799.00</span>}
          onClick={() => {}}
        />
        <ListRow leading={<ShoppingBag size={16} strokeWidth={1.5} />} title="Shoes" subtitle="Shopping · 3 Nov" trailing={<span className="tnum">−₹3,499.00</span>} onClick={() => {}} />
      </Card>

      <div className="flex flex-wrap gap-2">
        <Tag>Auto</Tag>
        <Tag tone="positive">Under budget</Tag>
        <Tag tone="warning">80%</Tag>
        <Tag tone="negative">Over</Tag>
      </div>
    </div>
  )
}
