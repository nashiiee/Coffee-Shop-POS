import type { Category } from '../catalog/types'

interface CategoryNavProps {
  categories: Category[]
  selectedCategoryId: string | null
  onSelect: (categoryId: string | null) => void
}

export function CategoryNav({ categories, selectedCategoryId, onSelect }: CategoryNavProps) {
  return (
    <nav aria-label="Product categories" className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selectedCategoryId === null}
        className={`rounded-full px-5 py-2 text-sm font-medium transition ${
          selectedCategoryId === null ? 'bg-[#201810] text-white' : 'text-stone-500 hover:bg-stone-100'
        }`}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          aria-pressed={selectedCategoryId === category.id}
          className={`rounded-full px-5 py-2 text-sm font-medium transition ${
            selectedCategoryId === category.id ? 'bg-[#201810] text-white' : 'text-stone-500 hover:bg-stone-100'
          }`}
        >
          {category.name}
        </button>
      ))}
    </nav>
  )
}
