import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReceiptView } from './ReceiptView'
import { AuthContext } from '../auth/authContext'
import type { Shop } from '../auth/types'
import type { OrderRecord } from './types'

const testShop: Shop = { id: 'shop-1', name: 'Culture Cup', logoUrl: null }

function renderReceipt(order: OrderRecord, shop: Shop | null = testShop) {
  return render(
    <AuthContext.Provider value={{ user: null, shop, accessToken: null, isLoading: false, login: vi.fn(), logout: vi.fn() }}>
      <ReceiptView order={order} />
    </AuthContext.Provider>,
  )
}

const baseOrder: OrderRecord = {
  id: 'order-1',
  sequenceNumber: 42,
  status: 'COMPLETED',
  subtotal: 30150,
  discountNameSnapshot: null,
  discountAmount: 0,
  total: 30150,
  notes: null,
  createdAt: new Date('2026-01-15T10:30:00Z').toISOString(),
  cashier: { id: 'cashier-1', name: 'Cara' },
  discount: null,
  items: [
    {
      id: 'item-1',
      productNameSnapshot: 'Americano',
      variantNameSnapshot: 'Medium',
      unitPriceSnapshot: 15000,
      quantity: 2,
      lineSubtotal: 30150,
      modifiers: [{ id: 'mod-1', modifierNameSnapshot: 'Extra Shot', priceSnapshot: 75 }],
    },
  ],
  payment: { method: 'CASH', amountDue: 30150, amountReceived: 30000, changeGiven: 0 },
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
}

describe('ReceiptView', () => {
  it("shows the logged-in shop's name, order number, timestamp, and cashier", () => {
    renderReceipt(baseOrder)
    expect(screen.getByText('Culture Cup')).toBeInTheDocument()
    expect(screen.getByText('Order #000042')).toBeInTheDocument()
    expect(screen.getByText('Cashier: Cara')).toBeInTheDocument()
  })

  it('falls back to the default name when no shop is available', () => {
    renderReceipt(baseOrder, null)
    expect(screen.getByText('Coffee Shop POS')).toBeInTheDocument()
  })

  it('shows each item with its variant, quantity, and per-item modifiers', () => {
    renderReceipt(baseOrder)
    expect(screen.getByText(/2× Americano \(Medium\)/)).toBeInTheDocument()
    expect(screen.getByText('+ Extra Shot')).toBeInTheDocument()
    expect(screen.getByText('₱0.75')).toBeInTheDocument()
    expect(screen.getByText('₱150.00 each')).toBeInTheDocument()
  })

  it('hides the discount line entirely when no discount was applied', () => {
    renderReceipt(baseOrder)
    expect(screen.queryByText(/^Discount/)).not.toBeInTheDocument()
  })

  it('shows the discount name and amount when a discount was applied', () => {
    const discounted: OrderRecord = {
      ...baseOrder,
      subtotal: 30150,
      discountNameSnapshot: 'E2E Test 10%',
      discountAmount: 3015,
      total: 27135,
    }
    renderReceipt(discounted)
    expect(screen.getByText('Discount (E2E Test 10%)')).toBeInTheDocument()
    expect(screen.getByText('−₱30.15')).toBeInTheDocument()
    expect(screen.getByText('₱271.35')).toBeInTheDocument()
  })

  it('shows subtotal, total, payment method, amount received, and change', () => {
    const withChange: OrderRecord = { ...baseOrder, payment: { method: 'CASH', amountDue: 30150, amountReceived: 30000, changeGiven: 2865 } }
    renderReceipt(withChange)
    // Item line-subtotal, receipt subtotal, and total are all ₱301.50 here (single item, no discount).
    expect(screen.getAllByText('₱301.50')).toHaveLength(3)
    expect(screen.getByText('CASH')).toBeInTheDocument()
    expect(screen.getByText('₱300.00')).toBeInTheDocument()
    expect(screen.getByText('₱28.65')).toBeInTheDocument()
  })

  it('renders an item with no variant and no modifiers without crashing or showing stray labels', () => {
    const simple: OrderRecord = {
      ...baseOrder,
      items: [
        {
          id: 'item-2',
          productNameSnapshot: 'Croissant',
          variantNameSnapshot: null,
          unitPriceSnapshot: 325,
          quantity: 1,
          lineSubtotal: 325,
          modifiers: [],
        },
      ],
    }
    renderReceipt(simple)
    expect(screen.getByText(/1× Croissant/)).toBeInTheDocument()
    expect(screen.queryByText('(null)')).not.toBeInTheDocument()
  })
})
