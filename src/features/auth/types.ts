export type Role = 'ADMIN' | 'CASHIER'

export interface User {
  id: string
  name: string
  email: string
  role: Role
}

export interface Shop {
  id: string
  name: string
  logoUrl: string | null
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  shop: Shop
  accessToken: string
}
