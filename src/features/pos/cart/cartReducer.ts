import { calcLineTotal } from './pricing'
import type { AddItemPayload, CartLineItem, CartState } from './types'

export type CartAction =
  | { type: 'ADD_ITEM'; payload: AddItemPayload }
  | { type: 'INCREMENT'; lineId: string }
  | { type: 'DECREMENT'; lineId: string }
  | { type: 'REMOVE_ITEM'; lineId: string }
  | { type: 'SET_NOTES'; notes: string }
  | { type: 'RESET' }

export const initialCartState: CartState = { items: [], notes: '' }

function modifierSignature(modifiers: { modifierId: string }[]): string {
  return modifiers
    .map((m) => m.modifierId)
    .sort()
    .join(',')
}

// Two "add to cart" actions for the exact same product + variant + modifier
// selection merge into one line (quantity increases) instead of creating a
// duplicate line — matches how a cashier expects tapping the same drink
// twice to behave.
function findMatchingLineIndex(items: CartLineItem[], payload: AddItemPayload): number {
  const signature = modifierSignature(payload.modifiers)
  return items.findIndex(
    (item) =>
      item.productId === payload.productId &&
      item.variantId === payload.variantId &&
      modifierSignature(item.modifiers) === signature,
  )
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const matchIndex = findMatchingLineIndex(state.items, action.payload)
      if (matchIndex !== -1) {
        // Merge quantity into the matching line, but also refresh
        // unitPrice/modifiers from this payload rather than keeping the
        // existing line's stale values — the catalog is the source of
        // truth and may have changed price since the first add.
        const items = state.items.map((item, index) =>
          index === matchIndex
            ? {
                ...item,
                quantity: item.quantity + action.payload.quantity,
                unitPrice: action.payload.unitPrice,
                modifiers: action.payload.modifiers,
              }
            : item,
        )
        return { ...state, items }
      }
      const newItem: CartLineItem = {
        id: crypto.randomUUID(),
        productId: action.payload.productId,
        productName: action.payload.productName,
        variantId: action.payload.variantId,
        variantName: action.payload.variantName,
        unitPrice: action.payload.unitPrice,
        modifiers: action.payload.modifiers,
        quantity: action.payload.quantity,
      }
      return { ...state, items: [...state.items, newItem] }
    }
    case 'INCREMENT':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.lineId ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      }
    case 'DECREMENT': {
      // Decrementing to zero removes the line — there's no such thing as a
      // zero-quantity cart line, so this also serves as one way to remove.
      const items = state.items
        .map((item) => (item.id === action.lineId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0)
      return { ...state, items }
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((item) => item.id !== action.lineId) }
    case 'SET_NOTES':
      return { ...state, notes: action.notes }
    case 'RESET':
      return initialCartState
    default:
      return state
  }
}

export function lineTotal(item: CartLineItem): number {
  return calcLineTotal(
    item.unitPrice,
    item.modifiers.map((m) => m.price),
    item.quantity,
  )
}

export function cartSubtotal(state: CartState): number {
  return state.items.reduce((sum, item) => sum + lineTotal(item), 0)
}

export function cartItemCount(state: CartState): number {
  return state.items.reduce((sum, item) => sum + item.quantity, 0)
}
