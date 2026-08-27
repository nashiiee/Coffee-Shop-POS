import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CheckoutScreen } from './CheckoutScreen'
import { AuthContext } from '../auth/authContext'
import { CartContext } from '../pos/cart/cartContext'
import * as checkoutApi from './api'
import type { User } from '../auth/types'
import type { CartState } from '../pos/cart/types'
import type { Discount, OrderRecord } from './types'

vi.mock('./api')

const cashier: User = { id: 'cashier-1', name: 'Cara', email: 'c@x.com', role: 'CASHIER' }

const cart: CartState = {
  items: [
    {
      id: 'line-1',
      productId: 'prod-latte',
      productName: 'Latte',
      variantId: 'var-large',
      variantName: 'Large',
      unitPrice: 50000,
      modifiers: [{ modifierId: 'mod-shot', name: 'Extra Shot', price: 7500 }],
      quantity: 1,
    },
  ],
  notes: '',
  discountId: null,
}

const discounts: Discount[] = [{ id: 'disc-1', name: '10% Off', type: 'PERCENTAGE', value: 10, isActive: true, expiresAt: null }]

function renderCheckout(onSuccess = vi.fn(), onCancel = vi.fn(), cartOverride: CartState = cart) {
  return render(
    <AuthContext.Provider
      value={{ user: cashier, shop: null, accessToken: 'token', isLoading: false, login: vi.fn(), logout: vi.fn() }}
    >
      <CartContext.Provider value={{ cart: cartOverride, dispatch: vi.fn() }}>
        <CheckoutScreen onSuccess={onSuccess} onCancel={onCancel} />
      </CartContext.Provider>
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.mocked(checkoutApi.listDiscounts).mockResolvedValue(discounts)
})

describe('CheckoutScreen — order summary', () => {
  it('shows the cart items and computed subtotal/total', async () => {
    renderCheckout()
    expect(await screen.findByText(/Latte — Large × 1/)).toBeInTheDocument()
    expect(screen.getByText('Extra Shot')).toBeInTheDocument()
    // (500.00 + 75.00) = 575.00 subtotal, shown for both subtotal and Total Due
    expect(screen.getAllByText('₱575.00').length).toBeGreaterThan(0)
  })

  it('reduces the total when a discount is selected', async () => {
    // Discount selection now happens in the cart panel before checkout —
    // this screen just reads whatever is already on cart.discountId.
    renderCheckout(vi.fn(), vi.fn(), { ...cart, discountId: 'disc-1' })
    await screen.findByText(/Latte — Large/)
    // 575.00 - 10% (57.50, floored to 57.50 exactly here) = 517.50, shown
    // in both the order-summary Total row and the Payment "Total Due" row.
    await waitFor(() => expect(screen.getAllByText('₱517.50').length).toBeGreaterThanOrEqual(1))
  })
})

describe('CheckoutScreen — cash payment validation', () => {
  it('disables Complete Payment and shows the shortfall for insufficient cash', async () => {
    renderCheckout()
    await screen.findByText(/Latte — Large/)
    await userEvent.type(screen.getByLabelText('Cash Received'), '500')
    expect(screen.getByText(/Insufficient payment/)).toBeInTheDocument()
    expect(screen.getByText(/₱75\.00/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Complete Payment/ })).toBeDisabled()
  })

  it('enables Complete Payment and shows change for sufficient cash', async () => {
    renderCheckout()
    await screen.findByText(/Latte — Large/)
    await userEvent.type(screen.getByLabelText('Cash Received'), '600')
    expect(screen.getByText('Change')).toBeInTheDocument()
    expect(screen.getByText('₱25.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Complete Payment/ })).toBeEnabled()
  })
})

describe('CheckoutScreen — submission', () => {
  it('submits the correct payload and calls onSuccess with the returned order', async () => {
    const onSuccess = vi.fn()
    const order = { id: 'order-1', sequenceNumber: 1 } as OrderRecord
    vi.mocked(checkoutApi.checkout).mockResolvedValue(order)

    renderCheckout(onSuccess)
    await screen.findByText(/Latte — Large/)
    await userEvent.type(screen.getByLabelText('Cash Received'), '600')
    await userEvent.click(screen.getByRole('button', { name: /Complete Payment/ }))

    await waitFor(() =>
      expect(checkoutApi.checkout).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({
          items: [{ productId: 'prod-latte', variantId: 'var-large', modifierIds: ['mod-shot'], quantity: 1 }],
          amountReceived: 60000,
        }),
      ),
    )
    expect(onSuccess).toHaveBeenCalledWith(order)
  })

  it('shows a server error and keeps the screen open without calling onSuccess', async () => {
    const onSuccess = vi.fn()
    const { ApiError } = await import('../../lib/apiClient')
    vi.mocked(checkoutApi.checkout).mockRejectedValue(new ApiError(409, 'CONFLICT', 'Insufficient stock for Latte'))

    renderCheckout(onSuccess)
    await screen.findByText(/Latte — Large/)
    await userEvent.type(screen.getByLabelText('Cash Received'), '600')
    await userEvent.click(screen.getByRole('button', { name: /Complete Payment/ }))

    expect(await screen.findByText('Insufficient stock for Latte')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onCancel when Back to cart is clicked', async () => {
    const onCancel = vi.fn()
    renderCheckout(vi.fn(), onCancel)
    await screen.findByText(/Latte — Large/)
    await userEvent.click(screen.getByRole('button', { name: 'Back to cart' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
