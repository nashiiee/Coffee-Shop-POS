import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoriesPage } from './CategoriesPage'
import { AuthContext } from '../auth/authContext'
import { ToastProvider } from '../admin/ToastProvider'
import * as catalogApi from './api'
import type { User } from '../auth/types'
import type { Category } from './types'

vi.mock('./api')

const admin: User = { id: 'admin-1', name: 'Admin', email: 'a@x.com', role: 'ADMIN' }

function renderPage() {
  return render(
    <AuthContext.Provider value={{ user: admin, accessToken: 'token', isLoading: false, login: vi.fn(), logout: vi.fn() }}>
      <ToastProvider>
        <CategoriesPage />
      </ToastProvider>
    </AuthContext.Provider>,
  )
}

const coffee: Category = { id: 'cat-1', name: 'Coffee', sortOrder: 0, isActive: true, parentId: null }

beforeEach(() => {
  vi.mocked(catalogApi.listCategories).mockResolvedValue([coffee])
})

describe('CategoriesPage', () => {
  it('lists existing categories', async () => {
    renderPage()
    expect(await screen.findByText('Coffee')).toBeInTheDocument()
  })

  it('creates a new category and refreshes the list', async () => {
    const created: Category = { id: 'cat-2', name: 'Tea', sortOrder: 0, isActive: true, parentId: null }
    vi.mocked(catalogApi.createCategory).mockResolvedValue(created)
    vi.mocked(catalogApi.listCategories).mockResolvedValueOnce([coffee]).mockResolvedValueOnce([coffee, created])

    renderPage()
    await screen.findByText('Coffee')

    await userEvent.click(screen.getByRole('button', { name: 'Add category' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Category name'), 'Tea')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add category' }))

    await waitFor(() => expect(catalogApi.createCategory).toHaveBeenCalledWith('token', { name: 'Tea' }))
    expect(await screen.findByText('Tea')).toBeInTheDocument()
  })

  it('shows a success toast after creating a category', async () => {
    const created: Category = { id: 'cat-2', name: 'Tea', sortOrder: 0, isActive: true, parentId: null }
    vi.mocked(catalogApi.createCategory).mockResolvedValue(created)
    vi.mocked(catalogApi.listCategories).mockResolvedValueOnce([coffee]).mockResolvedValueOnce([coffee, created])

    renderPage()
    await screen.findByText('Coffee')

    await userEvent.click(screen.getByRole('button', { name: 'Add category' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Category name'), 'Tea')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add category' }))

    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent('Category "Tea" added')
  })

  it('deactivates a category', async () => {
    vi.mocked(catalogApi.updateCategory).mockResolvedValue({ ...coffee, isActive: false })

    renderPage()
    await screen.findByText('Coffee')

    await userEvent.click(screen.getByRole('button', { name: /deactivate/i }))

    await waitFor(() =>
      expect(catalogApi.updateCategory).toHaveBeenCalledWith('token', 'cat-1', { isActive: false }),
    )
  })
})
