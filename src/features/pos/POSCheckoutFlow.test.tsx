import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { POSHome } from './POSHome'
import { AuthContext } from '../auth/authContext'
import * as catalogApi from '../catalog/api'
import * as checkoutApi from '../checkout/api'
import type { User } from '../auth/types'
import type { Category, Product } from '../catalog/types'
import type { OrderRecord } from '../checkout/types'

vi.mock('../catalog/api')
vi.mock('../checkout/api')

const cashier: User = { id: 'cashier-1', name: 'Cara', email: 'c@x.com', role: 'CASHIER' }

const categories: Category[] = [{ id: 'cat-coffee', name: 'Coffee', sortOrder: 0, isActive: true, parentId: null }]

const drip: Product = {
  id: 'prod-drip',
  categoryId: 'cat-coffee',
  name: 'Drip Coffee',
  description: null,
  basePrice: 25000,
  isActive: true,
  imageUrl: null,
  category: categories[0]!,
  variants: [],
  modifiers: [],
}

function renderPOS() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{ user: cashier, accessToken: 'token', isLoading: false, login: vi.fn(), logout: vi.fn() }}
      >
        <POSHome />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(catalogApi.listProducts).mockResolvedValue([drip])
  vi.mocked(catalogApi.listCategories).mockResolvedValue(categories)
  vi.mocked(checkoutApi.listDiscounts).mockResolvedValue([])
})

describe('POS — full checkout flow', () => {
  it('walks Login-authenticated cashier through add product -> cart -> checkout -> payment -> success -> new order', async () => {
    const completedOrder: OrderRecord = {
      id: 'order-1',
      sequenceNumber: 7,
      status: 'COMPLETED',
      subtotal: 25000,
      discountNameSnapshot: null,
      discountAmount: 0,
      total: 25000,
      notes: null,
      createdAt: new Date().toISOString(),
      cashier: { id: 'cashier-1', name: 'Cara' },
      discount: null,
      items: [
        {
          id: 'item-1',
          productNameSnapshot: 'Drip Coffee',
          variantNameSnapshot: null,
          unitPriceSnapshot: 25000,
          quantity: 1,
          lineSubtotal: 25000,
          modifiers: [],
        },
      ],
      payment: { method: 'CASH', amountDue: 25000, amountReceived: 30000, changeGiven: 5000 },
      voidedAt: null,
      voidedBy: null,
      voidReason: null,
    }
    vi.mocked(checkoutApi.checkout).mockResolvedValue(completedOrder)

    renderPOS()

    // Add to cart
    await userEvent.click(await screen.findByRole('button', { name: /Drip Coffee/ }))
    const cart = screen.getByRole('complementary')
    expect(within(cart).getByText('Drip Coffee')).toBeInTheDocument()

    // Go to checkout
    await userEvent.click(within(cart).getByRole('button', { name: 'Checkout' }))
    expect(await screen.findByText('Order summary')).toBeInTheDocument()

    // Insufficient cash first — button must stay disabled
    await userEvent.type(screen.getByLabelText('Cash Received'), '100')
    expect(screen.getByRole('button', { name: /Complete Payment/ })).toBeDisabled()

    // Correct the amount to a sufficient one
    await userEvent.clear(screen.getByLabelText('Cash Received'))
    await userEvent.type(screen.getByLabelText('Cash Received'), '300')
    expect(screen.getByRole('button', { name: /Complete Payment/ })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: /Complete Payment/ }))

    // Success screen
    expect(await screen.findByText('Payment Successful')).toBeInTheDocument()
    expect(screen.getByText('Order #000007')).toBeInTheDocument()

    // New order returns to the shopping view with an empty cart
    await userEvent.click(screen.getByRole('button', { name: 'New Order' }))
    expect(await screen.findByText('Drip Coffee', { selector: 'button *, button' })).toBeInTheDocument()
    const freshCart = screen.getByRole('complementary')
    expect(within(freshCart).getByText(/No items yet/)).toBeInTheDocument()
  })
})
