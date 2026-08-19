import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ProductFormPage } from './ProductFormPage'
import { AuthContext } from '../auth/authContext'
import * as catalogApi from './api'
import type { User } from '../auth/types'
import type { Category, Modifier, Product } from './types'

vi.mock('./api')

const admin: User = { id: 'admin-1', name: 'Admin', email: 'a@x.com', role: 'ADMIN' }

const categories: Category[] = [{ id: 'cat-1', name: 'Coffee', sortOrder: 0, isActive: true }]
const modifiers: Modifier[] = [
  { id: 'mod-1', name: 'Extra Shot', price: 75, isActive: true },
  { id: 'mod-2', name: 'Vanilla Syrup', price: 60, isActive: true },
]

function renderAt(path: string) {
  return render(
    <AuthContext.Provider value={{ user: admin, accessToken: 'token', isLoading: false, login: vi.fn(), logout: vi.fn() }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
          <Route path="/admin/products/:id" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.mocked(catalogApi.listCategories).mockResolvedValue(categories)
  vi.mocked(catalogApi.listModifiers).mockResolvedValue(modifiers)
})

describe('ProductFormPage — create', () => {
  it('creates a product from the form values', async () => {
    const created: Product = {
      id: 'prod-1',
      categoryId: 'cat-1',
      name: 'Latte',
      description: null,
      basePrice: 450,
      isActive: true,
      imageUrl: null,
      category: categories[0]!,
      variants: [],
      modifiers: [],
    }
    vi.mocked(catalogApi.createProduct).mockResolvedValue(created)
    vi.mocked(catalogApi.getProduct).mockResolvedValue(created)

    renderAt('/admin/products/new')
    await screen.findByText('Coffee', { selector: 'option' })

    await userEvent.selectOptions(screen.getByLabelText('Category'), 'cat-1')
    await userEvent.type(screen.getByLabelText('Name'), 'Latte')
    await userEvent.type(screen.getByLabelText('Base price'), '4.50')
    await userEvent.click(screen.getByRole('button', { name: /create product/i }))

    await waitFor(() =>
      expect(catalogApi.createProduct).toHaveBeenCalledWith('token', {
        categoryId: 'cat-1',
        name: 'Latte',
        description: undefined,
        basePrice: 450,
      }),
    )
  })
})

describe('ProductFormPage — edit', () => {
  const existingProduct: Product = {
    id: 'prod-1',
    categoryId: 'cat-1',
    name: 'Latte',
    description: 'Espresso with steamed milk',
    basePrice: 450,
    isActive: true,
    imageUrl: null,
    category: categories[0]!,
    variants: [{ id: 'var-1', productId: 'prod-1', name: 'Large', price: 550, isActive: true }],
    modifiers: [{ productId: 'prod-1', modifierId: 'mod-1', modifier: modifiers[0]! }],
  }

  it('pre-fills the form and reflects currently-assigned modifiers', async () => {
    vi.mocked(catalogApi.getProduct).mockResolvedValue(existingProduct)

    renderAt('/admin/products/prod-1')

    expect(await screen.findByDisplayValue('Latte')).toBeInTheDocument()
    expect(screen.getByText('Large — ₱5.50')).toBeInTheDocument()

    const extraShotCheckbox = await screen.findByLabelText(/Extra Shot/)
    const vanillaCheckbox = screen.getByLabelText(/Vanilla Syrup/)
    expect(extraShotCheckbox).toBeChecked()
    expect(vanillaCheckbox).not.toBeChecked()
  })

  it('saves the updated modifier selection', async () => {
    vi.mocked(catalogApi.getProduct).mockResolvedValue(existingProduct)
    vi.mocked(catalogApi.setProductModifiers).mockResolvedValue(existingProduct)

    renderAt('/admin/products/prod-1')
    await screen.findByDisplayValue('Latte')

    await userEvent.click(screen.getByLabelText(/Vanilla Syrup/))
    await userEvent.click(screen.getByRole('button', { name: /save modifiers/i }))

    await waitFor(() =>
      expect(catalogApi.setProductModifiers).toHaveBeenCalledWith(
        'token',
        'prod-1',
        expect.arrayContaining(['mod-1', 'mod-2']),
      ),
    )
  })
})
