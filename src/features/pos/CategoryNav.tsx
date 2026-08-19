import type { Category } from '../catalog/types'

interface CategoryNavProps {
  categories: Category[]
  selectedCategoryId: string | null
  onSelect: (categoryId: string | null) => void
}

export function CategoryNav({ categories, selectedCategoryId, onSelect }: CategoryNavProps) {
  return (
    <nav aria-label="Product categories" className="flex flex-col gap-1 overflow-y-auto">
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selectedCategoryId === null}
        className={`rounded-lg px-4 py-3 text-left text-base font-medium ${
          selectedCategoryId === null ? 'bg-amber-800 text-white' : 'bg-gray-100 hover:bg-amber-100'
        }`}
      >
        All items
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          aria-pressed={selectedCategoryId === category.id}
          className={`rounded-lg px-4 py-3 text-left text-base font-medium ${
            selectedCategoryId === category.id ? 'bg-amber-800 text-white' : 'bg-gray-100 hover:bg-amber-100'
          }`}
        >
          {category.name}
        </button>
      ))}
    </nav>
  )
}
