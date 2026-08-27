import { iconForCategory } from '../admin/categoryIcons'
import type { Category } from '../catalog/types'

interface CategoryRailProps {
  categories: Category[]
  selectedCategoryId: string | null
  onSelect: (categoryId: string | null) => void
  isExpanded: boolean
}

// Icon-first department nav. Collapsed (default) shows just the glyph —
// legible at a glance and matches the rail's fixed icon-strip width.
// Expanded (toggled from the hamburger button in POSHome) shows the glyph
// plus the department name for a cashier who wants to double-check before
// tapping.
export function CategoryRail({ categories, selectedCategoryId, onSelect, isExpanded }: CategoryRailProps) {
  return (
    <nav aria-label="Top-level categories" className="flex h-full w-full flex-col justify-evenly gap-2 px-2">
      {categories.map((category) => {
        const Icon = iconForCategory(category.name)
        const isSelected = selectedCategoryId === category.id
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            aria-pressed={isSelected}
            aria-label={isExpanded ? undefined : category.name}
            title={category.name}
            className={`flex items-center gap-3 rounded-xl py-2.5 transition ${isExpanded ? 'justify-start px-3' : 'justify-center px-1'} ${
              isSelected ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white/70'
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {isExpanded ? <span className="truncate text-sm font-medium">{category.name}</span> : null}
          </button>
        )
      })}
    </nav>
  )
}
