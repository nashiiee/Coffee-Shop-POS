import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiscountsPage } from './DiscountsPage'
import { AuthContext } from '../auth/authContext'
import { ToastProvider } from '../admin/ToastProvider'
import * as discountsApi from './api'
import type { User } from '../auth/types'
import type { Discount } from './types'

vi.mock('./api')

const admin: User = { id: 'admin-1', name: 'Admin', email: 'a@x.com', role: 'ADMIN' }

function renderPage() {
  return render(
    <AuthContext.Provider value={{ user: admin, shop: null, accessToken: 'token', isLoading: false, login: vi.fn(), logout: vi.fn() }}>
      <ToastProvider>
        <DiscountsPage />
      </ToastProvider>
    </AuthContext.Provider>,
  )
}

const tenPercentOff: Discount = { id: 'disc-1', name: '10% Off', type: 'PERCENTAGE', value: 10, isActive: true, expiresAt: null }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(discountsApi.listDiscounts).mockResolvedValue([tenPercentOff])
})

describe('DiscountsPage — listing', () => {
  it('lists existing discounts with their type and value', async () => {
    renderPage()
    expect(await screen.findByText(/10% Off/)).toBeInTheDocument()
    expect(screen.getByText(/10% off/)).toBeInTheDocument()
  })

  it('shows inactive discounts with a status label', async () => {
    vi.mocked(discountsApi.listDiscounts).mockResolvedValue([{ ...tenPercentOff, isActive: false }])
    renderPage()
    expect(await screen.findByText('Inactive')).toBeInTheDocument()
  })
})

describe('DiscountsPage — create', () => {
  it('creates a percentage discount', async () => {
    const created: Discount = { id: 'disc-2', name: 'New Promo', type: 'PERCENTAGE', value: 15, isActive: true, expiresAt: null }
    vi.mocked(discountsApi.createDiscount).mockResolvedValue(created)
    vi.mocked(discountsApi.listDiscounts).mockResolvedValueOnce([tenPercentOff]).mockResolvedValueOnce([tenPercentOff, created])

    renderPage()
    await screen.findByText(/10% Off/)

    await userEvent.click(screen.getByRole('button', { name: 'Add discount' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Discount name'), 'New Promo')
    await userEvent.selectOptions(within(dialog).getByLabelText('Discount type'), 'PERCENTAGE')
    await userEvent.type(within(dialog).getByLabelText('Discount value'), '15')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add discount' }))

    await waitFor(() =>
      expect(discountsApi.createDiscount).toHaveBeenCalledWith('token', { name: 'New Promo', type: 'PERCENTAGE', value: 15 }),
    )
    // Scoped to the card's name element — a plain /New Promo/ text query now
    // also matches the success toast ("Discount \"New Promo\" added"),
    // which would make the query ambiguous.
    expect(await screen.findByText('New Promo', { selector: 'p' })).toBeInTheDocument()
  })

  it('creates a fixed-amount discount, converting dollars to cents', async () => {
    const created: Discount = { id: 'disc-3', name: '₱50 Off', type: 'FIXED', value: 5000, isActive: true, expiresAt: null }
    vi.mocked(discountsApi.createDiscount).mockResolvedValue(created)

    renderPage()
    await screen.findByText(/10% Off/)

    await userEvent.click(screen.getByRole('button', { name: 'Add discount' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Discount name'), '₱50 Off')
    await userEvent.selectOptions(within(dialog).getByLabelText('Discount type'), 'FIXED')
    await userEvent.type(within(dialog).getByLabelText('Discount value'), '50')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add discount' }))

    await waitFor(() =>
      expect(discountsApi.createDiscount).toHaveBeenCalledWith('token', { name: '₱50 Off', type: 'FIXED', value: 5000 }),
    )
  })

  it('includes an expiry date in the create payload when provided', async () => {
    vi.mocked(discountsApi.createDiscount).mockResolvedValue(tenPercentOff)

    renderPage()
    await screen.findByText(/10% Off/)

    await userEvent.click(screen.getByRole('button', { name: 'Add discount' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Discount name'), 'Holiday Promo')
    await userEvent.type(within(dialog).getByLabelText('Discount value'), '20')
    await userEvent.type(within(dialog).getByLabelText('Discount expiry date'), '2026-12-31')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add discount' }))

    await waitFor(() =>
      expect(discountsApi.createDiscount).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({ expiresAt: expect.stringContaining('2026-12-31') }),
      ),
    )
  })

  it('surfaces a server validation error (e.g. percentage over 100) without crashing', async () => {
    const { ApiError } = await import('../../lib/apiClient')
    vi.mocked(discountsApi.createDiscount).mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'A percentage discount value cannot exceed 100'),
    )

    renderPage()
    await screen.findByText(/10% Off/)

    await userEvent.click(screen.getByRole('button', { name: 'Add discount' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Discount name'), 'Too Much')
    await userEvent.type(within(dialog).getByLabelText('Discount value'), '150')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add discount' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A percentage discount value cannot exceed 100')
  })
})

describe('DiscountsPage — edit', () => {
  it('edits a discount value inline', async () => {
    vi.mocked(discountsApi.updateDiscount).mockResolvedValue({ ...tenPercentOff, value: 20 })

    renderPage()
    await screen.findByText(/10% Off/)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const valueInput = screen.getByLabelText('Edit value for 10% Off')
    await userEvent.clear(valueInput)
    await userEvent.type(valueInput, '20')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(discountsApi.updateDiscount).toHaveBeenCalledWith(
        'token',
        'disc-1',
        expect.objectContaining({ name: '10% Off', type: 'PERCENTAGE', value: 20 }),
      ),
    )
  })

  it('cancels edit mode without saving', async () => {
    renderPage()
    await screen.findByText(/10% Off/)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Edit value for 10% Off')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Edit value for 10% Off')).not.toBeInTheDocument()
    expect(discountsApi.updateDiscount).not.toHaveBeenCalled()
  })

  it('clears the value field when switching type, so a percentage is never silently reinterpreted as a dollar amount', async () => {
    renderPage()
    await screen.findByText(/10% Off/)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const valueInput = screen.getByLabelText('Edit value for 10% Off')
    expect(valueInput).toHaveValue(10) // pre-filled from the existing 10% discount

    await userEvent.selectOptions(screen.getByLabelText('Edit type for 10% Off'), 'FIXED')

    expect(valueInput).toHaveValue(null) // must NOT still show "10" (which would submit as ₱10.00)
  })
})

describe('DiscountsPage — activate/deactivate', () => {
  it('deactivates an active discount', async () => {
    vi.mocked(discountsApi.updateDiscount).mockResolvedValue({ ...tenPercentOff, isActive: false })

    renderPage()
    await screen.findByText(/10% Off/)

    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => expect(discountsApi.updateDiscount).toHaveBeenCalledWith('token', 'disc-1', { isActive: false }))
  })

  it('reactivates an inactive discount', async () => {
    vi.mocked(discountsApi.listDiscounts).mockResolvedValue([{ ...tenPercentOff, isActive: false }])
    vi.mocked(discountsApi.updateDiscount).mockResolvedValue(tenPercentOff)

    renderPage()
    await screen.findByText(/10% Off/)

    await userEvent.click(screen.getByRole('button', { name: 'Activate' }))

    await waitFor(() => expect(discountsApi.updateDiscount).toHaveBeenCalledWith('token', 'disc-1', { isActive: true }))
  })
})
