import { createContext } from 'react'
import type { LoginRequest, User } from './types'

export interface AuthContextValue {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
