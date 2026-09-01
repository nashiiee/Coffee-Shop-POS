import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import * as dashboardApi from '../dashboard/api'
import type { LowStockProduct } from '../dashboard/types'
import { ToastProvider } from './ToastProvider'
import {
  AlertIcon,
  BellIcon,
  CategoryIcon,
  ChartIcon,
  ClipboardIcon,
  CupIcon,
  DashboardIcon,
  DiscountIcon,
  InventoryIcon,
  LogoutIcon,
  ModifierIcon,
  ReceiptIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from './icons'

const NAV_GROUPS = [
  {
    label: 'Dashboard',
    items: [{ to: '/admin', end: true, label: 'Overview', Icon: DashboardIcon }],
  },
  {
    label: 'Sales',
    items: [
      { to: '/admin/orders', end: false, label: 'Orders', Icon: ReceiptIcon },
      { to: '/admin/reports', end: false, label: 'Reports', Icon: ChartIcon },
    ],
  },
  {
    label: 'Finance',
    items: [{ to: '/admin/expenses', end: false, label: 'Expenses', Icon: WalletIcon }],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/admin/products', end: false, label: 'Products', Icon: CupIcon },
      { to: '/admin/categories', end: false, label: 'Categories', Icon: CategoryIcon },
      { to: '/admin/modifiers', end: false, label: 'Modifiers', Icon: ModifierIcon },
      { to: '/admin/discounts', end: false, label: 'Discounts', Icon: DiscountIcon },
    ],
  },
  {
    label: 'Operations',
    items: [{ to: '/admin/inventory', end: false, label: 'Inventory', Icon: InventoryIcon }],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/users', end: false, label: 'Cashiers', Icon: UsersIcon },
      { to: '/admin/audit-log', end: false, label: 'Audit Log', Icon: ClipboardIcon },
    ],
  },
] as const

const SHOP_NAME = 'Culture Cup'

export function AdminLayout() {
  const { user, logout, accessToken } = useAuth()
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    dashboardApi
      .getDashboard(accessToken)
      .then((data) => {
        if (!cancelled) setLowStockProducts(data.lowStockProducts)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [accessToken])

  useEffect(() => {
    if (!isNotifOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isNotifOpen])

  const notificationCount = lowStockProducts.length

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-stone-50">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/culture-cup-logo.jpg" alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
            <span className="hidden text-base font-semibold text-stone-800 sm:inline">{SHOP_NAME}</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/pos"
              className="flex items-center gap-2 rounded-lg bg-stone-900 px-3 py-2 text-xs font-medium text-white hover:bg-stone-800 sm:text-sm"
            >
              <CupIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Go to POS</span>
            </Link>

            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => setIsNotifOpen((open) => !open)}
                aria-label="Notifications"
                aria-expanded={isNotifOpen}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <BellIcon />
                {notificationCount > 0 ? (
                  <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                    {notificationCount}
                  </span>
                ) : null}
              </button>

              {isNotifOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-stone-200 bg-white shadow-lg">
                  <div className="border-b border-stone-100 px-4 py-3">
                    <p className="text-sm font-semibold text-stone-800">Notifications</p>
                  </div>
                  {notificationCount === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-stone-400">You're all caught up.</p>
                  ) : (
                    <ul className="max-h-80 divide-y divide-stone-100 overflow-y-auto">
                      {lowStockProducts.map((product) => (
                        <li key={product.productId}>
                          <Link
                            to="/admin/inventory"
                            onClick={() => setIsNotifOpen(false)}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-stone-50"
                          >
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                              <AlertIcon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-stone-800">{product.name}</span>
                              <span className="block text-xs text-stone-500">
                                Low stock — {product.quantityOnHand} on hand (reorder at {product.reorderLevel})
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {notificationCount > 0 ? (
                    <Link
                      to="/admin/inventory"
                      onClick={() => setIsNotifOpen(false)}
                      className="block border-t border-stone-100 px-4 py-2.5 text-center text-xs font-medium text-stone-600 hover:bg-stone-50"
                    >
                      View all inventory
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>

            <span className="hidden text-sm font-medium text-stone-600 sm:inline">{user?.name}</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500">
              <UserIcon />
            </span>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-16 shrink-0 flex-col bg-[#2b1b12] px-2 py-7 lg:w-64 lg:px-4">
            <div className="flex-1 space-y-9">
              {NAV_GROUPS.map((group, i) => (
                <div key={group.label} className={i > 0 ? 'border-t border-white/10 pt-9' : ''}>
                  <p className="mb-3 hidden px-3 text-xs font-semibold tracking-widest text-amber-100/40 uppercase lg:block">
                    {group.label}
                  </p>
                  <div className="space-y-1.5">
                    {group.items.map(({ to, end, label, Icon }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={end}
                        title={label}
                        className={({ isActive }) =>
                          `flex items-center justify-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors lg:justify-start ${
                            isActive ? 'bg-amber-600 text-white shadow-sm' : 'text-amber-100/70 hover:bg-white/5 hover:text-amber-50'
                          }`
                        }
                      >
                        <Icon className="shrink-0" />
                        <span className="hidden lg:inline">{label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => void logout()}
                title="Sign out"
                className="flex w-full items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-amber-100/70 transition-colors hover:bg-white/5 hover:text-amber-50 lg:justify-start"
              >
                <LogoutIcon className="shrink-0" />
                <span className="hidden lg:inline">Sign out</span>
              </button>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
