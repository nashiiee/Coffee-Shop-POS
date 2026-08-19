import { createContext } from 'react'
import type { CartAction } from './cartReducer'
import type { CartState } from './types'

export interface CartContextValue {
  cart: CartState
  dispatch: (action: CartAction) => void
}

export const CartContext = createContext<CartContextValue | undefined>(undefined)
