import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { OrdersPage } from './OrdersPage'
import { AuthContext } from '../auth/authContext'
import * as ordersApi from './api'
import type { User } from '../auth/types'
import type { ListOrdersResponse } from './types'

vi.mock('./api')

const cashier: User = { id: 'cashier-1', name: 'Cara', email: 'c@x.com', role: 'CASHIER' }
const admin: User = { id: 'admin-1', name: 'Admin', email: 'a@x.com', role: 'ADMIN' }

function renderPage(user: User, basePath?: string) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user, shop: null, accessToken: 'token', isLoading: false, login: vi.fn(), logout: vi.fn() }}>
        <OrdersPage basePath={basePath} />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

const sampleResult: ListOrdersResponse = {
  orders: [
    {
      id: 'order-1',
      sequenceNumber: 7,
      status: 'COMPLETED',
      subtotal: 40000,
      discountAmount: 0,
      total: 40000,
      createdAt: new Date('2026-01-15T10:30:00Z').toISOString(),
      cashier: { id: 'cashier-1', name: 'Cara' },
      payment: { method: 'CASH' },
      _count: { items: 2 },
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
}

beforeEach(() => {
  vi.mocked(ordersApi.listOrders).mockResolvedValue(sampleResult)
  vi.mocked(ordersApi.listCashiers).mockResolvedValue([{ id: 'cashier-1', name: 'Cara' }])
})

describe('OrdersPage — cashier view', () => {
  it('lists the cashier own orders without admin-only filters', async () => {
    renderPage(cashier)

    expect(await screen.findByText('#000007')).toBeInTheDocument()
    expect(screen.queryByLabelText('Date from')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Cashier')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
    expect(ordersApi.listCashiers).not.toHaveBeenCalled()
  })

  it('does not show the cashier column for a cashier', async () => {
    renderPage(cashier)
    await screen.findByText('#000007')
    expect(screen.queryByText('Cashier')).not.toBeInTheDocument()
  })

  it('searches by order number', async () => {
    renderPage(cashier)
    await screen.findByText('#000007')

    await userEvent.type(screen.getByLabelText(/search/i), '7')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() =>
      expect(ordersApi.listOrders).toHaveBeenLastCalledWith('token', expect.objectContaining({ search: '7', page: 1 })),
    )
  })
})

describe('OrdersPage — admin view', () => {
  it('shows admin-only filters and the cashier column', async () => {
    renderPage(admin)

    expect(await screen.findByText('#000007')).toBeInTheDocument()
    expect(screen.getByLabelText('Date from')).toBeInTheDocument()
    expect(screen.getByLabelText('Date to')).toBeInTheDocument()
    expect(screen.getByLabelText('Cashier')).toBeInTheDocument()
    expect(screen.getByLabelText('Payment Method')).toBeInTheDocument()
    expect(screen.getByLabelText('Status')).toBeInTheDocument()
    const row = screen.getByText('#000007').closest('tr')!
    expect(within(row).getByText('Cara')).toBeInTheDocument()
  })

  it('filters by status', async () => {
    renderPage(admin)
    await screen.findByText('#000007')

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'REFUNDED')

    await waitFor(() =>
      expect(ordersApi.listOrders).toHaveBeenLastCalledWith('token', expect.objectContaining({ status: 'REFUNDED', page: 1 })),
    )
  })

  it('filters by cashier using the fetched cashier list', async () => {
    renderPage(admin)
    await screen.findByText('#000007')

    await waitFor(() => expect(ordersApi.listCashiers).toHaveBeenCalledWith('token'))
    await userEvent.selectOptions(screen.getByLabelText('Cashier'), 'cashier-1')

    await waitFor(() =>
      expect(ordersApi.listOrders).toHaveBeenLastCalledWith('token', expect.objectContaining({ cashierId: 'cashier-1', page: 1 })),
    )
  })
})

describe('OrdersPage — basePath', () => {
  it('links "View receipt" to the given basePath, so an admin stays inside the admin shell', async () => {
    renderPage(admin, '/admin/orders')
    await screen.findByText('#000007')
    expect(screen.getByRole('link', { name: 'View receipt for order #000007' })).toHaveAttribute('href', '/admin/orders/order-1')
  })

  it('defaults to /orders when no basePath is given (cashier-facing route)', async () => {
    renderPage(cashier)
    await screen.findByText('#000007')
    expect(screen.getByRole('link', { name: 'View receipt for order #000007' })).toHaveAttribute('href', '/orders/order-1')
  })
})

describe('OrdersPage — export', () => {
  it('exports every matching order across pages, not just the page on screen', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock')
    URL.revokeObjectURL = vi.fn()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const page1 = {
      orders: Array.from({ length: 100 }, (_, i) => ({ ...sampleResult.orders[0]!, id: `order-${i}`, sequenceNumber: i + 1 })),
      total: 150,
      page: 1,
      pageSize: 100,
    }
    const page2 = {
      orders: Array.from({ length: 50 }, (_, i) => ({ ...sampleResult.orders[0]!, id: `order-${100 + i}`, sequenceNumber: 101 + i })),
      total: 150,
      page: 2,
      pageSize: 100,
    }
    vi.mocked(ordersApi.listOrders).mockImplementation((_token, filters) =>
      Promise.resolve(filters.page === 2 ? page2 : page1),
    )

    renderPage(admin)
    const exportButton = await screen.findByRole('button', { name: /export/i })
    await waitFor(() => expect(exportButton).not.toBeDisabled())

    await userEvent.click(exportButton)

    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
    expect(ordersApi.listOrders).toHaveBeenCalledWith('token', expect.objectContaining({ page: 1, pageSize: 100 }))
    expect(ordersApi.listOrders).toHaveBeenCalledWith('token', expect.objectContaining({ page: 2, pageSize: 100 }))

    clickSpy.mockRestore()
  })
})

describe('OrdersPage — empty and error states', () => {
  it('shows an empty message when there are no orders', async () => {
    vi.mocked(ordersApi.listOrders).mockResolvedValue({ orders: [], total: 0, page: 1, pageSize: 20 })
    renderPage(cashier)
    expect(await screen.findByText('No orders found.')).toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    const { ApiError } = await import('../../lib/apiClient')
    vi.mocked(ordersApi.listOrders).mockRejectedValue(new ApiError(500, 'SERVER_ERROR', 'Failed to load orders'))
    renderPage(cashier)
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load orders')
  })
})
