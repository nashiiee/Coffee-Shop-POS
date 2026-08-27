import { createContext } from 'react'
import type { LoginRequest, Shop, User } from './types'

export interface AuthContextValue {
  user: User | null
  shop: Shop | null
  accessToken: string | null
  isLoading: boolean
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
