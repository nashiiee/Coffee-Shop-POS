import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SuccessScreen } from './SuccessScreen'
import type { OrderRecord } from './types'

const order: OrderRecord = {
  id: 'order-1',
  sequenceNumber: 42,
  status: 'COMPLETED',
  subtotal: 45000,
  discountNameSnapshot: null,
  discountAmount: 0,
  total: 45000,
  notes: null,
  createdAt: new Date('2026-01-15T10:30:00Z').toISOString(),
  cashier: { id: 'cashier-1', name: 'Cara' },
  discount: null,
  items: [
    {
      id: 'item-1',
      productNameSnapshot: 'Latte',
      variantNameSnapshot: 'Large',
      unitPriceSnapshot: 45000,
      quantity: 1,
      lineSubtotal: 45000,
      modifiers: [],
    },
  ],
  payment: { method: 'CASH', amountDue: 45000, amountReceived: 50000, changeGiven: 5000 },
}

describe('SuccessScreen', () => {
  it('shows the order number, total, cash received, and change', () => {
    render(<SuccessScreen order={order} onNewOrder={vi.fn()} />)
    expect(screen.getByText('Payment Successful')).toBeInTheDocument()
    expect(screen.getByText('Order #000042')).toBeInTheDocument()
    expect(screen.getAllByText('₱450.00').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('₱500.00')).toBeInTheDocument()
    expect(screen.getByText('₱50.00')).toBeInTheDocument()
  })

  it('toggles the receipt view', async () => {
    render(<SuccessScreen order={order} onNewOrder={vi.fn()} />)
    expect(screen.queryByText('Coffee Shop POS')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'View Receipt' }))
    expect(screen.getByText('Coffee Shop POS')).toBeInTheDocument()
    expect(screen.getByText(/Latte \(Large\)/)).toBeInTheDocument()
  })

  it('calls onNewOrder when New Order is clicked', async () => {
    const onNewOrder = vi.fn()
    render(<SuccessScreen order={order} onNewOrder={onNewOrder} />)
    await userEvent.click(screen.getByRole('button', { name: 'New Order' }))
    expect(onNewOrder).toHaveBeenCalled()
  })
})
