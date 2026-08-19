import { BrowserRouter, Route, Routes } from 'react-router'
import { AuthProvider } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { AdminLayout } from './features/admin/AdminLayout'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { CategoriesPage } from './features/catalog/CategoriesPage'
import { ProductsPage } from './features/catalog/ProductsPage'
import { ProductFormPage } from './features/catalog/ProductFormPage'
import { ModifiersPage } from './features/catalog/ModifiersPage'
import { DiscountsPage } from './features/discounts/DiscountsPage'
import { InventoryPage } from './features/inventory/InventoryPage'
import { InventoryHistoryPage } from './features/inventory/InventoryHistoryPage'
import { POSHome } from './features/pos/POSHome'
import { OrdersPage } from './features/orders/OrdersPage'
import { OrderDetailPage } from './features/orders/OrderDetailPage'
import { UsersPage } from './features/users/UsersPage'
import { AuditLogPage } from './features/audit/AuditLogPage'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { RoleHome } from './routes/RoleHome'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <RoleHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="products/:id" element={<ProductFormPage />} />
            <Route path="modifiers" element={<ModifiersPage />} />
            <Route path="discounts" element={<DiscountsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="inventory/:productId/history" element={<InventoryHistoryPage />} />
            <Route path="orders" element={<OrdersPage basePath="/admin/orders" />} />
            <Route path="orders/:id" element={<OrderDetailPage backPath="/admin/orders" />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
          </Route>
          <Route
            path="/pos"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'CASHIER']}>
                <POSHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'CASHIER']}>
                <div className="mx-auto max-w-4xl px-6 py-8">
                  <OrdersPage />
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'CASHIER']}>
                <div className="mx-auto max-w-4xl px-6 py-8">
                  <OrderDetailPage />
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
