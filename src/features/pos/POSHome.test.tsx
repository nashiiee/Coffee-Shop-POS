import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { POSHome } from './POSHome'
import { AuthContext } from '../auth/authContext'
import * as catalogApi from '../catalog/api'
import type { User } from '../auth/types'
import type { Category, Product } from '../catalog/types'

vi.mock('../catalog/api')

const cashier: User = { id: 'cashier-1', name: 'Cara', email: 'c@x.com', role: 'CASHIER' }

const categories: Category[] = [
  { id: 'cat-coffee', name: 'Coffee', sortOrder: 0, isActive: true, parentId: null },
  { id: 'cat-bakery', name: 'Bakery', sortOrder: 1, isActive: true, parentId: null },
]

const drip: Product = {
  id: 'prod-drip',
  categoryId: 'cat-coffee',
  name: 'Drip Coffee',
  description: null,
  basePrice: 250,
  isActive: true,
  imageUrl: null,
  category: categories[0]!,
  variants: [],
  modifiers: [],
}

const latte: Product = {
  id: 'prod-latte',
  categoryId: 'cat-coffee',
  name: 'Latte',
  description: null,
  basePrice: 400,
  isActive: true,
  imageUrl: null,
  category: categories[0]!,
  variants: [
    { id: 'var-small', productId: 'prod-latte', name: 'Small', price: 400, isActive: true },
    { id: 'var-large', productId: 'prod-latte', name: 'Large', price: 500, isActive: true },
  ],
  modifiers: [
    {
      productId: 'prod-latte',
      modifierId: 'mod-shot',
      modifier: { id: 'mod-shot', name: 'Extra Shot', price: 75, isActive: true },
    },
  ],
}

const cappuccino: Product = {
  id: 'prod-cappuccino',
  categoryId: 'cat-coffee',
  name: 'Cappuccino',
  description: null,
  basePrice: 350,
  isActive: true,
  imageUrl: null,
  category: categories[0]!,
  variants: [
    { id: 'var-cap-small', productId: 'prod-cappuccino', name: 'Small', price: 350, isActive: true },
    { id: 'var-cap-large', productId: 'prod-cappuccino', name: 'Large', price: 450, isActive: true },
  ],
  modifiers: [],
}

const croissant: Product = {
  id: 'prod-croissant',
  categoryId: 'cat-bakery',
  name: 'Croissant',
  description: null,
  basePrice: 325,
  isActive: true,
  imageUrl: null,
  category: categories[1]!,
  variants: [],
  modifiers: [],
}

const inactiveMuffin: Product = {
  id: 'prod-muffin',
  categoryId: 'cat-bakery',
  name: 'Muffin',
  description: null,
  basePrice: 300,
  isActive: false,
  imageUrl: null,
  category: categories[1]!,
  variants: [],
  modifiers: [],
}

function renderPOS() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{ user: cashier, shop: null, accessToken: 'token', isLoading: false, login: vi.fn(), logout: vi.fn() }}
      >
        <POSHome />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(catalogApi.listProducts).mockResolvedValue([drip, latte, cappuccino, croissant, inactiveMuffin])
  vi.mocked(catalogApi.listCategories).mockResolvedValue(categories)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POS cart — product catalog', () => {
  it('shows only active products', async () => {
    renderPOS()
    expect(await screen.findByText('Drip Coffee')).toBeInTheDocument()
    expect(screen.queryByText('Muffin')).not.toBeInTheDocument()
  })

  it('filters the grid by category', async () => {
    renderPOS()
    await screen.findByText('Drip Coffee')
    await userEvent.click(screen.getByRole('button', { name: 'Bakery' }))
    expect(screen.queryByText('Drip Coffee')).not.toBeInTheDocument()
    expect(screen.getByText('Croissant')).toBeInTheDocument()
  })

  it('filters the grid by search', async () => {
    renderPOS()
    await screen.findByText('Drip Coffee')
    await userEvent.type(screen.getByLabelText('Search products'), 'latte')
    expect(screen.queryByText('Drip Coffee')).not.toBeInTheDocument()
    expect(screen.getByText('Latte')).toBeInTheDocument()
  })
})

describe('POS cart — adding items', () => {
  it('adds a product with no variants/modifiers to the cart with a single tap', async () => {
    renderPOS()
    await userEvent.click(await screen.findByRole('button', { name: /Drip Coffee/ }))
    const cart = screen.getByRole('complementary')
    expect(within(cart).getByText('Drip Coffee')).toBeInTheDocument()
    // ₱2.50 appears three times: the line's unit price, the subtotal, and the total.
    expect(within(cart).getAllByText('₱2.50')).toHaveLength(3)
  })

  it('opens a picker for a product with variants and modifiers, and adds the configured line', async () => {
    renderPOS()
    await userEvent.click(await screen.findByRole('button', { name: /^Latte/ }))

    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByText(/Large/))
    await userEvent.click(within(dialog).getByLabelText(/Extra Shot/))
    await userEvent.click(within(dialog).getByRole('button', { name: /Add to order/ }))

    const cart = screen.getByRole('complementary')
    expect(within(cart).getByText('Latte — Large')).toBeInTheDocument()
    expect(within(cart).getByText('Extra Shot')).toBeInTheDocument()
    // 500 (large) + 75 (extra shot) = 575, shown as the line's unit price, the subtotal, and the total.
    expect(within(cart).getAllByText('₱5.75')).toHaveLength(3)
  })

  it('quick-adds a size-only product by tapping its size chip, with no dialog', async () => {
    renderPOS()
    await screen.findByText('Cappuccino')
    await userEvent.click(screen.getByRole('button', { name: /Cappuccino Large/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const cart = screen.getByRole('complementary')
    expect(within(cart).getByText('Cappuccino — Large')).toBeInTheDocument()
    // 450 shown as the line's unit price, the subtotal, and the total.
    expect(within(cart).getAllByText('₱4.50')).toHaveLength(3)
  })

  it('adds separate lines when different size chips of the same product are tapped', async () => {
    renderPOS()
    await screen.findByText('Cappuccino')
    await userEvent.click(screen.getByRole('button', { name: /Cappuccino Small/ }))
    await userEvent.click(screen.getByRole('button', { name: /Cappuccino Large/ }))

    const cart = screen.getByRole('complementary')
    expect(within(cart).getByText('Cappuccino — Small')).toBeInTheDocument()
    expect(within(cart).getByText('Cappuccino — Large')).toBeInTheDocument()
  })

  it('disables Add to order until a required variant is chosen', async () => {
    renderPOS()
    await userEvent.click(await screen.findByRole('button', { name: /^Latte/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: /Add to order/ })).toBeDisabled()
  })

  it('merges a second identical add-to-cart tap into the same line', async () => {
    renderPOS()
    const dripButton = await screen.findByRole('button', { name: /Drip Coffee/ })
    await userEvent.click(dripButton)
    await userEvent.click(dripButton)

    const cart = screen.getByRole('complementary')
    expect(within(cart).getAllByText('Drip Coffee')).toHaveLength(1)
    expect(within(cart).getByText('2')).toBeInTheDocument()
  })
})

describe('POS cart — managing the cart', () => {
  async function addDripToCart() {
    await userEvent.click(await screen.findByRole('button', { name: /Drip Coffee/ }))
  }

  it('increments and decrements quantity', async () => {
    renderPOS()
    await addDripToCart()
    const cart = screen.getByRole('complementary')
    await userEvent.click(within(cart).getByLabelText('Increase quantity of Drip Coffee'))
    expect(within(cart).getByText('2')).toBeInTheDocument()
    await userEvent.click(within(cart).getByLabelText('Decrease quantity of Drip Coffee'))
    expect(within(cart).getByText('1')).toBeInTheDocument()
  })

  it('removes an item directly', async () => {
    renderPOS()
    await addDripToCart()
    const cart = screen.getByRole('complementary')
    await userEvent.click(within(cart).getByLabelText('Remove Drip Coffee from order'))
    expect(within(cart).queryByText('Drip Coffee')).not.toBeInTheDocument()
    expect(within(cart).getByText(/No items yet/)).toBeInTheDocument()
  })

  it('shows a combined subtotal across multiple lines', async () => {
    renderPOS()
    await addDripToCart()
    // Drip Coffee and Croissant are in different top-level categories, and
    // the rail now defaults to the first one (Coffee) selected — switch to
    // Bakery to reach Croissant, same as a real cashier browsing both.
    await userEvent.click(await screen.findByRole('button', { name: 'Bakery' }))
    await userEvent.click(await screen.findByRole('button', { name: /Croissant/ }))
    const cart = screen.getByRole('complementary')
    // 2.50 + 3.25 = 5.75, shown as both the subtotal and the total (no discount applied pre-checkout).
    expect(within(cart).getAllByText('₱5.75')).toHaveLength(2)
  })

  it('clears the cart after confirming in the dialog', async () => {
    renderPOS()
    await addDripToCart()
    const cart = screen.getByRole('complementary')
    await userEvent.click(within(cart).getByRole('button', { name: 'Clear All' }))

    const dialog = screen.getByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Clear cart' }))

    expect(within(cart).getByText(/No items yet/)).toBeInTheDocument()
  })

  it('keeps the cart when cancelling the clear-cart dialog', async () => {
    renderPOS()
    await addDripToCart()
    const cart = screen.getByRole('complementary')
    await userEvent.click(within(cart).getByRole('button', { name: 'Clear All' }))

    const dialog = screen.getByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(within(cart).getByText('Drip Coffee')).toBeInTheDocument()
  })

  it('does not prompt to clear an already-empty cart', async () => {
    renderPOS()
    await screen.findByText('Drip Coffee')
    const cart = screen.getByRole('complementary')
    expect(within(cart).getByRole('button', { name: 'Clear All' })).toBeDisabled()
  })
})
