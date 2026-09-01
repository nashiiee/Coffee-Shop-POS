import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { OrderDetailPage } from './OrderDetailPage'
import { AuthContext } from '../auth/authContext'
import * as ordersApi from './api'
import type { User } from '../auth/types'
import type { OrderRecord } from '../checkout/types'

vi.mock('./api')

const cashier: User = { id: 'cashier-1', name: 'Cara', email: 'c@x.com', role: 'CASHIER' }
const admin: User = { id: 'admin-1', name: 'Ada', email: 'a@x.com', role: 'ADMIN' }

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
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
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

function renderAdminPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/orders/order-1']}>
      <AuthContext.Provider value={{ user: admin, accessToken: 'admin-token', isLoading: false, login: vi.fn(), logout: vi.fn() }}>
        <Routes>
          <Route path="/admin/orders/:id" element={<OrderDetailPage backPath="/admin/orders" />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
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

  it('never shows Cancel/Refund actions to a cashier, even for their own completed order', async () => {
    renderPage()
    await screen.findByText('Order #000042')
    expect(screen.queryByRole('button', { name: 'Cancel Order' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refund Order' })).not.toBeInTheDocument()
  })

  it('shows Cancel/Refund actions to an admin for a completed order', async () => {
    renderAdminPage()
    await screen.findByText('Order #000042')
    expect(screen.getByRole('button', { name: 'Cancel Order' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refund Order' })).toBeInTheDocument()
  })

  it('hides Cancel/Refund actions and shows a status banner for an already-voided order', async () => {
    vi.mocked(ordersApi.getOrder).mockResolvedValue({
      ...order,
      status: 'CANCELLED',
      voidedAt: new Date('2026-01-16T09:00:00Z').toISOString(),
      voidedBy: { id: 'admin-1', name: 'Ada' },
      voidReason: 'Customer changed their mind before pickup',
    })
    renderAdminPage()
    await screen.findByText('Order #000042')
    expect(screen.queryByRole('button', { name: 'Cancel Order' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refund Order' })).not.toBeInTheDocument()
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument()
    expect(screen.getByText(/Ada/)).toBeInTheDocument()
    expect(screen.getByText(/Customer changed their mind before pickup/)).toBeInTheDocument()
  })

  it('requires a reason before the Cancel Order dialog can be confirmed', async () => {
    const user = userEvent.setup()
    renderAdminPage()
    await screen.findByText('Order #000042')

    await user.click(screen.getByRole('button', { name: 'Cancel Order' }))
    // Two "Cancel Order" buttons now exist: the page action (used to open
    // the dialog) and the dialog's own confirm button — scope to the dialog.
    const dialog = screen.getByRole('alertdialog')
    const dialogConfirm = within(dialog).getByRole('button', { name: 'Cancel Order' })
    expect(dialogConfirm).toBeDisabled()

    await user.type(within(dialog).getByPlaceholderText(/customer requested/i), 'Wrong order placed')
    expect(dialogConfirm).toBeEnabled()
  })

  it('cancels the order and shows the updated status banner', async () => {
    const user = userEvent.setup()
    const cancelledOrder: OrderRecord = {
      ...order,
      status: 'CANCELLED',
      voidedAt: new Date('2026-01-16T09:00:00Z').toISOString(),
      voidedBy: { id: 'admin-1', name: 'Ada' },
      voidReason: 'Wrong order placed',
    }
    vi.mocked(ordersApi.cancelOrder).mockResolvedValue(cancelledOrder)

    renderAdminPage()
    await screen.findByText('Order #000042')
    await user.click(screen.getByRole('button', { name: 'Cancel Order' }))
    const dialog = screen.getByRole('alertdialog')
    await user.type(within(dialog).getByPlaceholderText(/customer requested/i), 'Wrong order placed')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel Order' }))

    expect(ordersApi.cancelOrder).toHaveBeenCalledWith('admin-token', 'order-1', 'Wrong order placed')
    expect(await screen.findByText(/Ada/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel Order' })).not.toBeInTheDocument()
  })

  it('shows an error inside the dialog (not hidden behind it) and keeps the dialog open on failure', async () => {
    const user = userEvent.setup()
    const { ApiError } = await import('../../lib/apiClient')
    vi.mocked(ordersApi.cancelOrder).mockRejectedValue(new ApiError(409, 'CONFLICT', 'This order is already refunded'))

    renderAdminPage()
    await screen.findByText('Order #000042')
    await user.click(screen.getByRole('button', { name: 'Cancel Order' }))
    const dialog = screen.getByRole('alertdialog')
    await user.type(within(dialog).getByPlaceholderText(/customer requested/i), 'Trying to cancel twice')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel Order' }))

    // The error must render inside the dialog — a page-level banner would be
    // hidden behind the dialog's own backdrop and never seen.
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This order is already refunded')
    // The dialog stays open (not silently closed) so the admin doesn't lose
    // the reason they already typed, and the order itself is unchanged.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.queryByText(/cancelled/i)).not.toBeInTheDocument()
  })

  it('refunds the order and calls the refund endpoint, not cancel', async () => {
    const user = userEvent.setup()
    const refundedOrder: OrderRecord = {
      ...order,
      status: 'REFUNDED',
      voidedAt: new Date('2026-01-16T09:00:00Z').toISOString(),
      voidedBy: { id: 'admin-1', name: 'Ada' },
      voidReason: 'Item was cold on arrival',
    }
    vi.mocked(ordersApi.refundOrder).mockResolvedValue(refundedOrder)

    renderAdminPage()
    await screen.findByText('Order #000042')
    await user.click(screen.getByRole('button', { name: 'Refund Order' }))
    const dialog = screen.getByRole('alertdialog')
    await user.type(within(dialog).getByPlaceholderText(/customer requested/i), 'Item was cold on arrival')
    await user.click(within(dialog).getByRole('button', { name: 'Refund Order' }))

    expect(ordersApi.refundOrder).toHaveBeenCalledWith('admin-token', 'order-1', 'Item was cold on arrival')
    expect(ordersApi.cancelOrder).not.toHaveBeenCalled()
    expect(await screen.findByText(/refunded/i)).toBeInTheDocument()
  })
})
