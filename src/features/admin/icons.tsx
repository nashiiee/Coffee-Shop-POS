// Minimal line-icon set for the admin sidebar — hand-drawn to match a single
// consistent stroke style (1.75, round caps/joins) rather than pulling in an
// icon library for eight glyphs.
type IconProps = { className?: string }

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function DashboardIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="3.5" width="7" height="8" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="14.5" width="7" height="6" rx="1.5" />
    </svg>
  )
}

export function CategoryIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 6.5A2.5 2.5 0 0 1 6 4h4.5l2 2.5H18A2.5 2.5 0 0 1 20.5 9v8A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17z" />
    </svg>
  )
}

export function CupIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 8h11v6.5A4.5 4.5 0 0 1 11.5 19H9.5A4.5 4.5 0 0 1 5 14.5z" />
      <path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8 5c-.6.6-.6 1.4 0 2M11.5 5c-.6.6-.6 1.4 0 2" />
    </svg>
  )
}

// Category-specific icon set, matching CupIcon's line style — used to give
// each catalog category (Coffee, Bakery, Tea, Juice, Dessert, Snack, Meal)
// a distinct glyph instead of one generic folder shape for all of them.
export function BreadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 16c0-5.5 3.6-10 8-10s8 4.5 8 10c-2.2-1.4-5-2-8-2s-5.8.6-8 2Z" />
      <path d="M8.5 12.5v2.5M12 11.5v3.5M15.5 12.5v2.5" />
    </svg>
  )
}

export function TeaIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.5c-3.5 2-6 5.7-6 9.5a6 6 0 0 0 12 0c0-3.8-2.5-7.5-6-9.5Z" />
      <path d="M12 8v9" />
    </svg>
  )
}

export function JuiceIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7 4h10l-1.3 14.3a2 2 0 0 1-2 1.8h-3.4a2 2 0 0 1-2-1.8z" />
      <path d="M6.5 8.5h11" />
      <path d="M15.5 3 17.5 6" />
    </svg>
  )
}

export function DessertIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6.5 12h11l-1.3 6.3a2 2 0 0 1-2 1.7H9.8a2 2 0 0 1-2-1.7Z" />
      <path d="M8 12c0-3 1.8-5 4-5s4 2 4 5" />
      <circle cx="12" cy="5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SnackIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="9.5" cy="10" r=".9" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="9.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="14" r=".9" fill="currentColor" stroke="none" />
      <circle cx="9" cy="14.5" r=".9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function MealIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6.5 3v5.5a1.5 1.5 0 0 0 3 0V3M8 8.5V21" />
      <path d="M16.5 3c-1.7 0-2.8 1.8-2.8 4.5S14.8 12 16.5 12M16.5 3v18" />
    </svg>
  )
}

export function CaffeineFreeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 19c8-1 14-7 15-15-8 1-14 7-15 15Z" />
      <path d="M7 17c4-4 8-8 12-12" />
    </svg>
  )
}

export function FrappuccinoIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7.5 8h9l-1 9.7a2 2 0 0 1-2 1.8h-3a2 2 0 0 1-2-1.8Z" />
      <path d="M6.5 8h11" />
      <path d="M13 8V3.5" />
      <path d="M9.3 11.5h5.4M9.6 14.5h4.8" />
    </svg>
  )
}

export function MilkshakeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 8.5h8l-.9 9.2a2 2 0 0 1-2 1.8h-2.2a2 2 0 0 1-2-1.8Z" />
      <path d="M7 8.5h10" />
      <path d="M15 8.5c.8-1.6.3-3.2-1-4.3" />
      <circle cx="14" cy="4" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function RefresherIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.5c3.2 4.3 6 8.3 6 11.8a6 6 0 0 1-12 0c0-3.5 2.8-7.5 6-11.8Z" />
      <path d="M9 15.3c0 1.5 1.2 2.7 2.7 2.7" />
    </svg>
  )
}

export function PastryIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M16.5 4a8.2 8.2 0 1 0 0 16 6.6 6.6 0 0 1 0-16Z" />
      <path d="M9.5 9.8c.5.6.5 1.3 0 1.9M12.8 8.6c.5.6.5 1.3 0 1.9" />
    </svg>
  )
}

export function ModifierIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function DiscountIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="8" cy="8" r="2.25" />
      <circle cx="16" cy="16" r="2.25" />
      <path d="M17.5 6.5l-11 11" />
    </svg>
  )
}

export function InventoryIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8.5 12 4l8 4.5-8 4.5-8-4.5Z" />
      <path d="M4 8.5V16l8 4.5 8-4.5V8.5" />
      <path d="M12 13v7.5" />
    </svg>
  )
}

export function ReceiptIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3.5h12v17l-2.5-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 20.5Z" />
      <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4.5" />
    </svg>
  )
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 20V10M11 20V4M18 20v-6" />
      <path d="M3.5 20.5h17" />
    </svg>
  )
}

export function CoinIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5v9M9.5 10c0-1.1 1-1.8 2.5-1.8s2.5.7 2.5 1.6c0 2.2-5 1.1-5 3.3 0 .9 1 1.6 2.5 1.6s2.5-.6 2.5-1.7" />
    </svg>
  )
}

export function WalletIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8.5A2 2 0 0 1 6 6.5h10A2.5 2.5 0 0 1 18.5 9v7A2.5 2.5 0 0 1 16 18.5H6A2 2 0 0 1 4 16.5Z" />
      <path d="M4 8.5V6.5A2 2 0 0 1 6 4.5h7" />
      <path d="M15 12h2.5a1.3 1.3 0 0 1 0 2.6H15a1.3 1.3 0 0 1 0-2.6Z" />
    </svg>
  )
}

export function ScaleIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4v16M8 20h8" />
      <path d="M12 6.5 5 8.5l3.5 6.5L12 13z" />
      <path d="M12 6.5 19 8.5l-3.5 6.5L12 13z" />
    </svg>
  )
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.5 21 19.5H3z" />
      <path d="M12 10v4M12 16.5v.01" />
    </svg>
  )
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  )
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" />
    </svg>
  )
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M19.5 19.5 15 15" />
    </svg>
  )
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  )
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  )
}

export function PrinterIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6.5 8.5V4h11v4.5" />
      <rect x="3.5" y="8.5" width="17" height="8" rx="1.5" />
      <path d="M6.5 15h11v5.5h-11z" />
    </svg>
  )
}

export function FilterIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6h16M7.5 12h9M10.5 18h3" />
    </svg>
  )
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4v11.5M7.5 11.5 12 16l4.5-4.5" />
      <path d="M4.5 18.5h15" />
    </svg>
  )
}

export function BagIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5.5 9h13l-1 11.5h-11z" />
      <path d="M8.5 9V6.5a3.5 3.5 0 0 1 7 0V9" />
    </svg>
  )
}

export function TrendDownIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6l6 6 4-4 6 8" />
      <path d="M20 12v4M20 16h-4" />
    </svg>
  )
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h3" />
      <path d="M14 8.5 18 12l-4 3.5M18 12H9.5" />
    </svg>
  )
}

export function PowerIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4v7" />
      <path d="M7.5 6.5a7 7 0 1 0 9 0" />
    </svg>
  )
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 7h14" />
      <path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" />
      <path d="M7 7l1 12.5A1.5 1.5 0 0 0 9.5 21h5a1.5 1.5 0 0 0 1.5-1.5L17 7" />
      <path d="M10.5 11v6M13.5 11v6" />
    </svg>
  )
}

export function CameraIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  )
}

export function ClipboardIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="4.5" width="14" height="16" rx="1.5" />
      <path d="M9 4.5V3.5A1 1 0 0 1 10 2.5h4a1 1 0 0 1 1 1v1" />
      <path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h4" />
    </svg>
  )
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <path d="M15.5 6a3 3 0 0 1 0 5.8" />
      <path d="M17.5 13.7c2 .5 3 2.3 3 5.3" />
    </svg>
  )
}
