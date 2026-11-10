import {
  Baby,
  BookOpen,
  Briefcase,
  Car,
  CircleDashed,
  CirclePlus,
  Clapperboard,
  Coffee,
  Dumbbell,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  PawPrint,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Utensils,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react'

// Explicit map (not dynamic import) so only the icons we use are bundled and cached offline.
const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  car: Car,
  'shopping-bag': ShoppingBag,
  receipt: Receipt,
  'heart-pulse': HeartPulse,
  clapperboard: Clapperboard,
  'circle-dashed': CircleDashed,
  // more choices for custom categories
  'shopping-cart': ShoppingCart,
  coffee: Coffee,
  house: House,
  plane: Plane,
  fuel: Fuel,
  wifi: Wifi,
  zap: Zap,
  smartphone: Smartphone,
  shirt: Shirt,
  dumbbell: Dumbbell,
  'book-open': BookOpen,
  'graduation-cap': GraduationCap,
  'paw-print': PawPrint,
  baby: Baby,
  gift: Gift,
  // income kinds
  sparkles: Sparkles,
  briefcase: Briefcase,
  'circle-plus': CirclePlus,
}

/** Icons offered when creating or editing a category (in picker order). */
export const CATEGORY_ICON_CHOICES = [
  'utensils', 'shopping-cart', 'coffee', 'car', 'fuel', 'plane',
  'house', 'receipt', 'wifi', 'zap', 'smartphone', 'shopping-bag',
  'shirt', 'heart-pulse', 'dumbbell', 'clapperboard', 'book-open', 'graduation-cap',
  'paw-print', 'baby', 'gift', 'circle-dashed',
] as const

/** 16px, 1.5px stroke line icon per the Design system. Decorative: pair it with a text label. */
export function CategoryIcon({ icon, className, size = 16 }: { icon: string | undefined; className?: string; size?: number }) {
  const Icon = (icon && ICONS[icon]) || CircleDashed
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" className={className} />
}
