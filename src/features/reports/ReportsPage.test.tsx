import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportsPage } from './ReportsPage'
import { AuthContext } from '../auth/authContext'
import * as reportsApi from './api'
import type { User } from '../auth/types'

vi.mock('./api')

const admin: User = { id: 'admin-1', name: 'Admin', email: 'a@x.com', role: 'ADMIN' }

function renderPage() {
  return render(
    <AuthContext.Provider value={{ user: admin, accessToken: 'token', isLoading: false, login: vi.fn(), logout: vi.fn() }}>
      <ReportsPage />
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.mocked(reportsApi.getSalesReport).mockResolvedValue({
    period: 'daily',
    dateFrom: '2026-01-01',
    dateTo: '2026-01-31',
    buckets: [{ date: '2026-01-15', totalSales: 40000, totalDiscounts: 4000, orderCount: 3 }],
  })
  vi.mocked(reportsApi.getProductSalesReport).mockResolvedValue({
    dateFrom: '2026-01-01',
    dateTo: '2026-01-31',
    products: [{ productId: 'p1', name: 'Latte', revenue: 80000, quantitySold: 20 }],
  })
  vi.mocked(reportsApi.getCancelledOrdersReport).mockResolvedValue({
    dateFrom: '2026-01-01',
    dateTo: '2026-01-31',
    total: 45,
    page: 1,
    pageSize: 20,
    orders: [],
  })
})

describe('ReportsPage — sales tab (default)', () => {
  it('loads the sales report on mount and shows the period selector', async () => {
    renderPage()
    expect(await screen.findByText('2026-01-15')).toBeInTheDocument()
    expect(screen.getByLabelText('Sales report period')).toBeInTheDocument()
  })

  it('refetches when the period changes', async () => {
    renderPage()
    await screen.findByText('2026-01-15')

    await userEvent.selectOptions(screen.getByLabelText('Sales report period'), 'monthly')

    await waitFor(() => expect(reportsApi.getSalesReport).toHaveBeenLastCalledWith('token', expect.objectContaining({ period: 'monthly' })))
  })
})

describe('ReportsPage — tab switching', () => {
  it('switches to the products tab and loads that report', async () => {
    renderPage()
    await screen.findByText('2026-01-15')

    await userEvent.click(screen.getByRole('button', { name: 'Products' }))

    expect(await screen.findByText('Latte')).toBeInTheDocument()
    expect(screen.queryByLabelText('Sales report period')).not.toBeInTheDocument()
  })

  it('resets to page 1 when switching tabs', async () => {
    renderPage()
    await screen.findByText('2026-01-15')

    await userEvent.click(screen.getByRole('button', { name: 'Cancelled Orders' }))
    await screen.findByText('Page 1 of 3')

    expect(reportsApi.getCancelledOrdersReport).toHaveBeenLastCalledWith('token', expect.objectContaining({ page: 1 }))
  })
})

describe('ReportsPage — pagination', () => {
  it('paginates the cancelled-orders report', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelled Orders' }))
    await screen.findByText('Page 1 of 3')

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(reportsApi.getCancelledOrdersReport).toHaveBeenLastCalledWith('token', expect.objectContaining({ page: 2 })))
  })
})

describe('ReportsPage — export', () => {
  it('exports the current tab as CSV', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock')
    URL.revokeObjectURL = vi.fn()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderPage()
    await screen.findByText('2026-01-15')

    await userEvent.click(screen.getByRole('button', { name: /export/i }))

    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
    clickSpy.mockRestore()
  })

  it('fetches every page of a paginated report before exporting it', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock')
    URL.revokeObjectURL = vi.fn()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelled Orders' }))
    await screen.findByText('Page 1 of 3')

    await userEvent.click(screen.getByRole('button', { name: /export/i }))

    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
    // The visible table paged with pageSize 20; the export re-fetches with
    // the server's max pageSize (100) so it isn't limited to one page.
    expect(reportsApi.getCancelledOrdersReport).toHaveBeenCalledWith('token', expect.objectContaining({ pageSize: 100 }))
    clickSpy.mockRestore()
  })
})

describe('ReportsPage — errors', () => {
  it('shows an error message when a report fails to load', async () => {
    const { ApiError } = await import('../../lib/apiClient')
    vi.mocked(reportsApi.getSalesReport).mockRejectedValue(new ApiError(500, 'SERVER_ERROR', 'Failed to load the report'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load the report')
  })
})
