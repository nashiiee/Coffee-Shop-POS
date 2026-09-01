import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { DashboardPage } from './DashboardPage'
import { AuthContext } from '../auth/authContext'
import * as dashboardApi from './api'
import type { User } from '../auth/types'
import type { DashboardData } from './types'

vi.mock('./api')

const admin: User = { id: 'admin-1', name: 'Admin', email: 'a@x.com', role: 'ADMIN' }

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user: admin, accessToken: 'token', isLoading: false, login: vi.fn(), logout: vi.fn() }}>
        <DashboardPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

const baseDashboard: DashboardData = {
  todaySales: 40000,
  todayOrders: 4,
  averageOrderValue: 10000,
  salesChangePercent: 25,
  ordersChangePercent: -10,
  averageOrderValueChangePercent: 15,
  cancelledOrdersToday: 1,
  cancelledOrdersChangePercent: 0,
  topProducts: [{ productId: 'p1', name: 'Latte', quantitySold: 20, revenue: 80000 }],
  paymentMethodBreakdown: [{ method: 'CASH', total: 39500, count: 6 }],
  lowStockProducts: [{ productId: 'p2', name: 'Croissant', quantityOnHand: 2, reorderLevel: 10 }],
  recentOrders: [
    {
      id: 'order-1',
      sequenceNumber: 42,
      total: 12000,
      createdAt: new Date('2026-01-15T10:30:00.000Z').toISOString(),
      cashierName: 'Cara',
      paymentMethod: 'CASH',
      itemCount: 2,
    },
  ],
  salesTrend: Array.from({ length: 7 }, (_, i) => ({ date: `2026-01-${10 + i}`, totalSales: i * 1000, orderCount: i })),
  hourlySales: Array.from({ length: 24 }, (_, hour) => ({ hour, totalSales: hour === 12 ? 4000 : 0 })),
}

beforeEach(() => {
  vi.mocked(dashboardApi.getDashboard).mockResolvedValue(baseDashboard)
})

describe('DashboardPage', () => {
  it('renders the stat tiles with formatted values', async () => {
    renderPage()
    expect(await screen.findByText('₱400.00')).toBeInTheDocument() // today's sales
    expect(screen.getByText('4')).toBeInTheDocument() // today's orders
    expect(screen.getByText('₱100.00')).toBeInTheDocument() // avg order value
  })

  it('shows an upward change badge for a positive percent change', async () => {
    renderPage()
    expect(await screen.findByText(/25\.0% vs\. yesterday/)).toBeInTheDocument()
  })

  it('shows a downward change badge for a negative percent change', async () => {
    renderPage()
    await screen.findByText(/25\.0% vs\. yesterday/)
    expect(screen.getByText(/10\.0% vs\. yesterday/)).toBeInTheDocument()
  })

  it('shows "n/a" when there is no prior-day baseline for comparison', async () => {
    vi.mocked(dashboardApi.getDashboard).mockResolvedValue({ ...baseDashboard, salesChangePercent: null })
    renderPage()
    expect(await screen.findByText(/vs\. yesterday: n\/a/)).toBeInTheDocument()
  })

  it('lists top products by revenue', async () => {
    renderPage()
    expect(await screen.findByText(/Latte/)).toBeInTheDocument()
  })

  it('flags low-stock products', async () => {
    renderPage()
    expect(await screen.findByText('Croissant')).toBeInTheDocument()
    expect(screen.getByText('2 units remaining')).toBeInTheDocument()
  })

  it('shows "sufficiently stocked" when nothing is low', async () => {
    vi.mocked(dashboardApi.getDashboard).mockResolvedValue({ ...baseDashboard, lowStockProducts: [] })
    renderPage()
    expect(await screen.findByText('All products are sufficiently stocked.')).toBeInTheDocument()
  })

  it('lists recent orders with order number and status', async () => {
    renderPage()
    expect(await screen.findByText('#000042')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('shows an error message when the dashboard fails to load', async () => {
    const { ApiError } = await import('../../lib/apiClient')
    vi.mocked(dashboardApi.getDashboard).mockRejectedValue(new ApiError(500, 'SERVER_ERROR', 'Failed to load the dashboard'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load the dashboard')
  })
})
