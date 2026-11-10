import { useEffect, useState } from 'react'
import { LayoutDashboard, ListOrdered, Repeat, Settings, type LucideIcon } from 'lucide-react'

export type RouteId = 'dashboard' | 'transactions' | 'fixed' | 'settings' | 'report' | 'ui'

export interface NavItem {
  id: Exclude<RouteId, 'ui' | 'report'>
  label: string
  icon: LucideIcon
}

export const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ListOrdered },
  { id: 'fixed', label: 'Fixed', icon: Repeat },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const ROUTES: RouteId[] = ['dashboard', 'transactions', 'fixed', 'settings', 'report', 'ui']

/** "#/report/abc" → { route: 'report', param: 'abc' }. Unknown routes go to the dashboard. */
export function parseRoute(hash: string): { route: RouteId; param?: string } {
  const [id, param] = hash.replace(/^#\/?/, '').split('/') as [RouteId, string | undefined]
  return ROUTES.includes(id) ? { route: id, param: param ? decodeURIComponent(param) : undefined } : { route: 'dashboard' }
}

/** Tiny hash router: works on any static host and offline, no server rewrites needed. */
export function useRoute(): [RouteId, (id: RouteId, param?: string) => void, string | undefined] {
  const [state, setState] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => setState(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const navigate = (id: RouteId, param?: string) => {
    window.location.hash = param ? `/${id}/${encodeURIComponent(param)}` : `/${id}`
  }
  return [state.route, navigate, state.param]
}
