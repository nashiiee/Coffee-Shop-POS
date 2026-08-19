import { useEffect, useMemo, useRef, useState } from 'react'
import type { Product } from '../catalog/types'
import { activeModifiers, activeVariants } from './productHelpers'
import { formatCents } from '../../lib/money'
import { calcLineTotal } from './cart/pricing'
import type { AddItemPayload, CartLineModifier } from './cart/types'

interface ProductPickerProps {
  product: Product
  onAdd: (payload: AddItemPayload) => void
  onClose: () => void
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function ProductPicker({ product, onAdd, onClose }: ProductPickerProps) {
  const variants = useMemo(() => activeVariants(product), [product])
  const modifiers = useMemo(() => activeModifiers(product), [product])
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const [variantId, setVariantId] = useState<string | null>(null)
  const [selectedModifierIds, setSelectedModifierIds] = useState<Set<string>>(new Set())
  const [quantity, setQuantity] = useState(1)

  // Runs once on mount only — must not re-run on unrelated re-renders (e.g.
  // a parent re-render from an unrelated cart dispatch), or it would steal
  // focus back to the close button out from under whatever the cashier is
  // currently interacting with inside the dialog.
  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const selectedVariant = variants.find((v) => v.id === variantId) ?? null
  const unitPrice = selectedVariant ? selectedVariant.price : product.basePrice
  const selectedModifiers: CartLineModifier[] = modifiers
    .filter((link) => selectedModifierIds.has(link.modifierId))
    .map((link) => ({ modifierId: link.modifierId, name: link.modifier.name, price: link.modifier.price }))
  const total = calcLineTotal(
    unitPrice,
    selectedModifiers.map((m) => m.price),
    quantity,
  )
  const canAdd = variants.length === 0 || variantId !== null

  function toggleModifier(modifierId: string) {
    setSelectedModifierIds((prev) => {
      const next = new Set(prev)
      if (next.has(modifierId)) next.delete(modifierId)
      else next.add(modifierId)
      return next
    })
  }

  function handleAdd() {
    if (!canAdd) return
    onAdd({
      productId: product.id,
      productName: product.name,
      variantId,
      variantName: selectedVariant?.name ?? null,
      unitPrice,
      modifiers: selectedModifiers,
      quantity,
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 id="product-picker-title" className="text-xl font-semibold">
            {product.name}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded px-2 py-1 text-lg leading-none hover:bg-gray-100"
          >
            ×
          </button>
        </div>

        {variants.length > 0 ? (
          <fieldset className="mb-4">
            <legend className="mb-2 text-sm font-medium">Size</legend>
            <div className="flex flex-wrap gap-2">
              {variants.map((variant) => (
                <label
                  key={variant.id}
                  className={`cursor-pointer rounded-lg border px-4 py-2 text-base peer-focus-visible:ring-2 peer-focus-visible:ring-black peer-focus-visible:ring-offset-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-black has-[:focus-visible]:ring-offset-2 ${
                    variantId === variant.id ? 'border-black bg-black text-white' : 'border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="variant"
                    value={variant.id}
                    checked={variantId === variant.id}
                    onChange={() => setVariantId(variant.id)}
                    className="peer sr-only"
                  />
                  {variant.name} — {formatCents(variant.price)}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {modifiers.length > 0 ? (
          <fieldset className="mb-4">
            <legend className="mb-2 text-sm font-medium">Add-ons</legend>
            <div className="flex flex-col gap-2">
              {modifiers.map((link) => (
                <label key={link.modifierId} className="flex items-center gap-2 text-base">
                  <input
                    type="checkbox"
                    checked={selectedModifierIds.has(link.modifierId)}
                    onChange={() => toggleModifier(link.modifierId)}
                    className="h-5 w-5"
                  />
                  {link.modifier.name} (+{formatCents(link.modifier.price)})
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm font-medium">Quantity</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="h-10 w-10 rounded-lg border text-xl"
          >
            −
          </button>
          <span className="w-8 text-center text-lg">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            aria-label="Increase quantity"
            className="h-10 w-10 rounded-lg border text-xl"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="w-full rounded-lg bg-amber-700 py-4 text-lg font-medium text-white disabled:opacity-40"
        >
          Add to order — {formatCents(total)}
        </button>
      </div>
    </div>
  )
}
