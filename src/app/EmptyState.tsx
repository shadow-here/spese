import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border px-6 py-12 text-center">
      <Icon size={16} strokeWidth={1.5} className="text-text-secondary" />
      <p className="text-body font-medium text-text-primary">{title}</p>
      <p className="max-w-xs text-label text-text-secondary">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
