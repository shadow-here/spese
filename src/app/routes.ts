import { useEffect, useState } from 'react'
import { LayoutDashboard, ListOrdered, Repeat, Settings, type LucideIcon } from 'lucide-react'

export type RouteId = 'dashboard' | 'transactions' | 'fixed' | 'settings' | 'ui'

export interface NavItem {
  id: Exclude<RouteId, 'ui'>
  label: string
  icon: LucideIcon
}

export const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ListOrdered },
  { id: 'fixed', label: 'Fixed', icon: Repeat },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const ROUTES: RouteId[] = ['dashboard', 'transactions', 'fixed', 'settings', 'ui']

function parse(hash: string): RouteId {
  const id = hash.replace(/^#\/?/, '') as RouteId
  return ROUTES.includes(id) ? id : 'dashboard'
}

/** Tiny hash router: works on any static host and offline, no server rewrites needed. */
export function useRoute(): [RouteId, (id: RouteId) => void] {
  const [route, setRoute] = useState<RouteId>(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const navigate = (id: RouteId) => {
    window.location.hash = `/${id}`
  }
  return [route, navigate]
}
