import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth'
import {
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

export function AdminLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-sm font-semibold text-white">
            C
          </span>
          <span className="hidden text-base font-semibold text-stone-800 sm:inline">Coffee Shop POS</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="text-stone-400">
            <BellIcon />
          </span>
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
  )
}
