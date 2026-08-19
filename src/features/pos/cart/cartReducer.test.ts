import { describe, expect, it } from 'vitest'
import { cartItemCount, cartReducer, cartSubtotal, initialCartState, lineTotal } from './cartReducer'
import type { AddItemPayload, CartState } from './types'

const latte: AddItemPayload = {
  productId: 'prod-latte',
  productName: 'Latte',
  variantId: 'var-medium',
  variantName: 'Medium',
  unitPrice: 450,
  modifiers: [],
  quantity: 1,
}

const drip: AddItemPayload = {
  productId: 'prod-drip',
  productName: 'Drip Coffee',
  variantId: null,
  variantName: null,
  unitPrice: 250,
  modifiers: [],
  quantity: 1,
}

describe('cartReducer — ADD_ITEM', () => {
  it('adds a new line item to an empty cart', () => {
    const state = cartReducer(initialCartState, { type: 'ADD_ITEM', payload: latte })
    expect(state.items).toHaveLength(1)
    expect(state.items[0]).toMatchObject({ productId: 'prod-latte', variantId: 'var-medium', quantity: 1 })
  })

  it('merges a second identical add into the existing line instead of duplicating it', () => {
    let state = cartReducer(initialCartState, { type: 'ADD_ITEM', payload: latte })
    state = cartReducer(state, { type: 'ADD_ITEM', payload: latte })
    expect(state.items).toHaveLength(1)
    expect(state.items[0]?.quantity).toBe(2)
  })

  it('keeps separate lines for the same product with different variants', () => {
    let state = cartReducer(initialCartState, { type: 'ADD_ITEM', payload: latte })
    state = cartReducer(state, {
      type: 'ADD_ITEM',
      payload: { ...latte, variantId: 'var-large', variantName: 'Large', unitPrice: 550 },
    })
    expect(state.items).toHaveLength(2)
  })

  it('keeps separate lines for the same product+variant with different modifier selections', () => {
    const withShot: AddItemPayload = {
      ...latte,
      modifiers: [{ modifierId: 'mod-shot', name: 'Extra Shot', price: 75 }],
    }
    let state = cartReducer(initialCartState, { type: 'ADD_ITEM', payload: latte })
    state = cartReducer(state, { type: 'ADD_ITEM', payload: withShot })
    expect(state.items).toHaveLength(2)
  })

  it('treats modifier order as irrelevant when matching an existing line', () => {
    const ab: AddItemPayload = {
      ...latte,
      modifiers: [
        { modifierId: 'mod-a', name: 'A', price: 50 },
        { modifierId: 'mod-b', name: 'B', price: 50 },
      ],
    }
    const ba: AddItemPayload = {
      ...latte,
      modifiers: [
        { modifierId: 'mod-b', name: 'B', price: 50 },
        { modifierId: 'mod-a', name: 'A', price: 50 },
      ],
    }
    let state = cartReducer(initialCartState, { type: 'ADD_ITEM', payload: ab })
    state = cartReducer(state, { type: 'ADD_ITEM', payload: ba })
    expect(state.items).toHaveLength(1)
    expect(state.items[0]?.quantity).toBe(2)
  })

  it('adds a distinct line for a different product', () => {
    let state = cartReducer(initialCartState, { type: 'ADD_ITEM', payload: latte })
    state = cartReducer(state, { type: 'ADD_ITEM', payload: drip })
    expect(state.items).toHaveLength(2)
  })

  it('refreshes price/modifiers on a merge instead of keeping the stale original values', () => {
    let state = cartReducer(initialCartState, { type: 'ADD_ITEM', payload: latte })
    const repriced: AddItemPayload = { ...latte, unitPrice: 475, quantity: 1 }
    state = cartReducer(state, { type: 'ADD_ITEM', payload: repriced })
    expect(state.items).toHaveLength(1)
    expect(state.items[0]?.quantity).toBe(2)
    expect(state.items[0]?.unitPrice).toBe(475)
  })
})

describe('cartReducer — quantity and removal', () => {
  function cartWithOneLatte(): CartState {
    return cartReducer(initialCartState, { type: 'ADD_ITEM', payload: latte })
  }

  it('increments quantity', () => {
    const state = cartWithOneLatte()
    const lineId = state.items[0]!.id
    const next = cartReducer(state, { type: 'INCREMENT', lineId })
    expect(next.items[0]?.quantity).toBe(2)
  })

  it('decrements quantity', () => {
    let state = cartWithOneLatte()
    const lineId = state.items[0]!.id
    state = cartReducer(state, { type: 'INCREMENT', lineId })
    state = cartReducer(state, { type: 'DECREMENT', lineId })
    expect(state.items[0]?.quantity).toBe(1)
  })

  it('removes the line when decrementing below one', () => {
    const state = cartWithOneLatte()
    const lineId = state.items[0]!.id
    const next = cartReducer(state, { type: 'DECREMENT', lineId })
    expect(next.items).toHaveLength(0)
  })

  it('removes a line directly regardless of quantity', () => {
    let state = cartWithOneLatte()
    const lineId = state.items[0]!.id
    state = cartReducer(state, { type: 'INCREMENT', lineId })
    state = cartReducer(state, { type: 'INCREMENT', lineId })
    const next = cartReducer(state, { type: 'REMOVE_ITEM', lineId })
    expect(next.items).toHaveLength(0)
  })

  it('does not affect other lines when adjusting one', () => {
    let state = cartWithOneLatte()
    state = cartReducer(state, { type: 'ADD_ITEM', payload: drip })
    const latteLineId = state.items[0]!.id
    const next = cartReducer(state, { type: 'INCREMENT', lineId: latteLineId })
    expect(next.items).toHaveLength(2)
    expect(next.items.find((i) => i.productId === 'prod-drip')?.quantity).toBe(1)
  })
})

describe('cartReducer — notes and reset', () => {
  it('sets order notes', () => {
    const state = cartReducer(initialCartState, { type: 'SET_NOTES', notes: 'Oat milk, extra hot' })
    expect(state.notes).toBe('Oat milk, extra hot')
  })

  it('resets items and notes together', () => {
    let state = cartReducer(initialCartState, { type: 'ADD_ITEM', payload: latte })
    state = cartReducer(state, { type: 'SET_NOTES', notes: 'For here' })
    const next = cartReducer(state, { type: 'RESET' })
    expect(next.items).toHaveLength(0)
    expect(next.notes).toBe('')
  })
})

describe('pricing helpers', () => {
  it('computes a line total including modifier prices times quantity', () => {
    const state = cartReducer(initialCartState, {
      type: 'ADD_ITEM',
      payload: { ...latte, modifiers: [{ modifierId: 'mod-shot', name: 'Extra Shot', price: 75 }], quantity: 3 },
    })
    expect(lineTotal(state.items[0]!)).toBe((450 + 75) * 3)
  })

  it('sums subtotal across multiple lines', () => {
    let state = cartReducer(initialCartState, { type: 'ADD_ITEM', payload: latte })
    state = cartReducer(state, { type: 'ADD_ITEM', payload: drip })
    expect(cartSubtotal(state)).toBe(450 + 250)
  })

  it('counts total item quantity across lines', () => {
    let state = cartReducer(initialCartState, { type: 'ADD_ITEM', payload: { ...latte, quantity: 2 } })
    state = cartReducer(state, { type: 'ADD_ITEM', payload: drip })
    expect(cartItemCount(state)).toBe(3)
  })
})
