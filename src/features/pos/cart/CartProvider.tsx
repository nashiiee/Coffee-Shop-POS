import { useMemo, useReducer, type ReactNode } from 'react'
import { CartContext } from './cartContext'
import { cartReducer, initialCartState } from './cartReducer'

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, initialCartState)
  const value = useMemo(() => ({ cart, dispatch }), [cart])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
