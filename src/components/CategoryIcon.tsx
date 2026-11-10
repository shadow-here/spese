import { Car, CircleDashed, Clapperboard, HeartPulse, Receipt, ShoppingBag, Utensils, type LucideIcon } from 'lucide-react'

// Explicit map (not dynamic import) so only the icons we use are bundled and cached offline.
const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  car: Car,
  'shopping-bag': ShoppingBag,
  receipt: Receipt,
  'heart-pulse': HeartPulse,
  clapperboard: Clapperboard,
  'circle-dashed': CircleDashed,
}

/** 16px, 1.5px stroke line icon per the Design system. Decorative: pair it with a text label. */
export function CategoryIcon({ icon, className }: { icon: string | undefined; className?: string }) {
  const Icon = (icon && ICONS[icon]) || CircleDashed
  return <Icon size={16} strokeWidth={1.5} aria-hidden="true" className={className} />
}
