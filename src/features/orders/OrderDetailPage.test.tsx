import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { OrderDetailPage } from './OrderDetailPage'
import { AuthContext } from '../auth/authContext'
import * as ordersApi from './api'
import type { User } from '../auth/types'
import type { OrderRecord } from '../checkout/types'

vi.mock('./api')

const cashier: User = { id: 'cashier-1', name: 'Cara', email: 'c@x.com', role: 'CASHIER' }

const order: OrderRecord = {
  id: 'order-1',
  sequenceNumber: 42,
  status: 'COMPLETED',
  subtotal: 12000,
  discountNameSnapshot: null,
  discountAmount: 0,
  total: 12000,
  notes: null,
  createdAt: new Date('2026-01-15T10:30:00Z').toISOString(),
  cashier: { id: 'cashier-1', name: 'Cara' },
  discount: null,
  items: [
    {
      id: 'item-1',
      productNameSnapshot: 'Latte',
      variantNameSnapshot: null,
      unitPriceSnapshot: 12000,
      quantity: 1,
      lineSubtotal: 12000,
      modifiers: [],
    },
  ],
  payment: { method: 'CASH', amountDue: 12000, amountReceived: 15000, changeGiven: 3000 },
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/orders/order-1']}>
      <AuthContext.Provider value={{ user: cashier, accessToken: 'token', isLoading: false, login: vi.fn(), logout: vi.fn() }}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(ordersApi.getOrder).mockResolvedValue(order)
})

describe('OrderDetailPage', () => {
  it('fetches and renders the receipt for the order in the URL', async () => {
    renderPage()
    expect(await screen.findByText('Order #000042')).toBeInTheDocument()
    expect(ordersApi.getOrder).toHaveBeenCalledWith('token', 'order-1')
    expect(screen.getByText(/Latte/)).toBeInTheDocument()
  })

  it('reprints via window.print when the button is clicked', async () => {
    const printSpy = vi.fn()
    vi.stubGlobal('print', printSpy)

    renderPage()
    await screen.findByText('Order #000042')
    await userEvent.click(screen.getByRole('button', { name: 'Reprint Receipt' }))

    expect(printSpy).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('links "Back to order history" to the given backPath, so an admin stays inside the admin shell', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/orders/order-1']}>
        <AuthContext.Provider value={{ user: cashier, accessToken: 'token', isLoading: false, login: vi.fn(), logout: vi.fn() }}>
          <Routes>
            <Route path="/admin/orders/:id" element={<OrderDetailPage backPath="/admin/orders" />} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )
    await screen.findByText('Order #000042')
    expect(screen.getByRole('link', { name: 'Back to order history' })).toHaveAttribute('href', '/admin/orders')
  })

  it('shows an error message when the order cannot be viewed (e.g. another cashier\'s order)', async () => {
    const { ApiError } = await import('../../lib/apiClient')
    vi.mocked(ordersApi.getOrder).mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'You do not have permission to view this order'))

    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to view this order')
  })
})
