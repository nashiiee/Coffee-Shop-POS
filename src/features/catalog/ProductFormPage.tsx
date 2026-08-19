import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { dollarsToCents, formatCents } from '../../lib/money'
import { resolveProductImage } from '../../lib/productImages'
import { CameraIcon } from '../admin/icons'
import * as catalogApi from './api'
import type { Category, Modifier, Product } from './types'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const inputClasses = 'rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none'

interface ImageDropzoneProps {
  previewUrl: string | null
  isUploading: boolean
  onFileSelected: (file: File) => void
}

// The dropzone renders at the same aspect-square + rounded-2xl treatment as
// a product card's image on the Products grid — what the admin sees here is
// exactly what the card will look like, not an abstracted upload widget.
function ImageDropzone({ previewUrl, isUploading, onFileSelected }: ImageDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (file) onFileSelected(file)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragActive(true)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragActive(false)
    handleFiles(event.dataTransfer.files)
  }

  return (
    <div className="w-full max-w-56">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
        className={`group relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition ${
          isDragActive ? 'border-amber-500 bg-amber-50' : 'border-stone-300 bg-stone-50 hover:border-amber-400 hover:bg-amber-50/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          className="sr-only"
          onChange={(event: ChangeEvent<HTMLInputElement>) => handleFiles(event.target.files)}
        />
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Product preview" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-stone-700">Change photo</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-center text-stone-400">
            <CameraIcon className="h-8 w-8" />
            <span className="text-xs font-medium">Click or drag a photo</span>
            <span className="text-[11px] text-stone-400">JPG, PNG, or WebP · up to 5MB</span>
          </div>
        )}
        {isUploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <span className="text-xs font-medium text-stone-600">Uploading…</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function ProductFormPage() {
  const { accessToken } = useAuth()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [categories, setCategories] = useState<Category[]>([])
  const [allModifiers, setAllModifiers] = useState<Modifier[]>([])
  const [product, setProduct] = useState<Product | null>(null)

  const [categoryId, setCategoryId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [stagedImageFile, setStagedImageFile] = useState<File | null>(null)
  const [previewOverride, setPreviewOverride] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const previewOverrideRef = useRef<string | null>(null)

  const [variantName, setVariantName] = useState('')
  const [variantPrice, setVariantPrice] = useState('')
  const [selectedModifierIds, setSelectedModifierIds] = useState<Set<string>>(new Set())

  function hydrateFromProduct(result: Product) {
    setProduct(result)
    setCategoryId(result.categoryId)
    setName(result.name)
    setDescription(result.description ?? '')
    setBasePrice((result.basePrice / 100).toString())
    setSelectedModifierIds(new Set(result.modifiers.map((link) => link.modifierId)))
  }

  async function loadProduct(productId: string) {
    const result = await catalogApi.getProduct(accessToken, productId)
    hydrateFromProduct(result)
  }

  function setPreview(objectUrl: string | null) {
    if (previewOverrideRef.current) URL.revokeObjectURL(previewOverrideRef.current)
    previewOverrideRef.current = objectUrl
    setPreviewOverride(objectUrl)
  }

  useEffect(() => {
    return () => {
      if (previewOverrideRef.current) URL.revokeObjectURL(previewOverrideRef.current)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    catalogApi
      .listCategories(accessToken)
      .then((result) => {
        if (!cancelled) setCategories(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load categories')
      })

    catalogApi
      .listModifiers(accessToken)
      .then((result) => {
        if (!cancelled) setAllModifiers(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load modifiers')
      })

    if (id) {
      catalogApi
        .getProduct(accessToken, id)
        .then((result) => {
          if (!cancelled) hydrateFromProduct(result)
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load product')
        })
    }

    return () => {
      cancelled = true
    }
  }, [accessToken, id])

  function validateImageFile(file: File): string | null {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Image must be JPEG, PNG, or WebP'
    if (file.size > MAX_IMAGE_BYTES) return 'Image is too large (max 5MB)'
    return null
  }

  function handleImageSelected(file: File) {
    const validationError = validateImageFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setPreview(URL.createObjectURL(file))

    if (id) {
      setIsUploadingImage(true)
      catalogApi
        .uploadProductImage(accessToken, id, file)
        .then(() => loadProduct(id))
        .then(() => setPreview(null))
        .catch((err: unknown) => {
          setError(err instanceof ApiError ? err.message : 'Failed to upload image')
          setPreview(null)
        })
        .finally(() => setIsUploadingImage(false))
    } else {
      setStagedImageFile(file)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const payload = { categoryId, name, description: description || undefined, basePrice: dollarsToCents(basePrice) }
    try {
      if (id) {
        await catalogApi.updateProduct(accessToken, id, payload)
        await loadProduct(id)
      } else {
        const created = await catalogApi.createProduct(accessToken, payload)
        if (stagedImageFile) {
          setIsUploadingImage(true)
          try {
            await catalogApi.uploadProductImage(accessToken, created.id, stagedImageFile)
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Product created, but the image failed to upload')
          } finally {
            setIsUploadingImage(false)
          }
        }
        navigate(`/admin/products/${created.id}`, { replace: true })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save product')
    }
  }

  async function toggleProductActive() {
    if (!id || !product) return
    setError(null)
    try {
      await catalogApi.updateProduct(accessToken, id, { isActive: !product.isActive })
      await loadProduct(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update product')
    }
  }

  async function handleAddVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!id) return
    setError(null)
    try {
      await catalogApi.createVariant(accessToken, id, { name: variantName, price: dollarsToCents(variantPrice) })
      setVariantName('')
      setVariantPrice('')
      await loadProduct(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add variant')
    }
  }

  async function toggleVariantActive(variantId: string, currentlyActive: boolean) {
    if (!id) return
    setError(null)
    try {
      await catalogApi.updateVariant(accessToken, id, variantId, { isActive: !currentlyActive })
      await loadProduct(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update variant')
    }
  }

  function toggleModifierSelection(modifierId: string) {
    setSelectedModifierIds((prev) => {
      const next = new Set(prev)
      if (next.has(modifierId)) next.delete(modifierId)
      else next.add(modifierId)
      return next
    })
  }

  async function handleSaveModifiers() {
    if (!id) return
    setError(null)
    try {
      await catalogApi.setProductModifiers(accessToken, id, Array.from(selectedModifierIds))
      await loadProduct(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save modifiers')
    }
  }

  const previewUrl =
    previewOverride ?? (product ? resolveProductImage(product.name, product.imageUrl) : null)

  return (
    <section className="max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/admin/products"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50"
          aria-label="Back to products"
        >
          ←
        </Link>
        <h2 className="text-xl font-semibold text-stone-800">{isEditing ? `Edit ${product?.name ?? '…'}` : 'New product'}</h2>
      </div>
      {error ? (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-6 sm:flex-row">
          <ImageDropzone previewUrl={previewUrl} isUploading={isUploadingImage} onFileSelected={handleImageSelected} />

          <div className="flex flex-1 flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-stone-600">Category</span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
                className={inputClasses}
              >
                <option value="" disabled>
                  Select a category
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-stone-600">Name</span>
              <input type="text" value={name} onChange={(event) => setName(event.target.value)} required className={inputClasses} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-stone-600">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                className={inputClasses}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-stone-600">Base price</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={basePrice}
                onChange={(event) => setBasePrice(event.target.value)}
                required
                className={`w-32 ${inputClasses}`}
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4 border-t border-stone-100 pt-5">
          <button type="submit" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
            {isEditing ? 'Save changes' : 'Create product'}
          </button>
          {isEditing && product ? (
            <button
              type="button"
              onClick={() => void toggleProductActive()}
              className={`text-sm font-medium ${product.isActive ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'}`}
            >
              {product.isActive ? 'Deactivate product' : 'Activate product'}
            </button>
          ) : null}
        </div>
      </form>

      {isEditing && product ? (
        <>
          <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-stone-800">Variants</h3>
            <form onSubmit={handleAddVariant} className="mb-4 flex flex-wrap gap-2">
              <input
                type="text"
                value={variantName}
                onChange={(event) => setVariantName(event.target.value)}
                placeholder="e.g. Large"
                aria-label="Variant name"
                required
                className={inputClasses}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={variantPrice}
                onChange={(event) => setVariantPrice(event.target.value)}
                placeholder="Price"
                aria-label="Variant price"
                required
                className={`w-28 ${inputClasses}`}
              />
              <button type="submit" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
                Add variant
              </button>
            </form>
            <ul className="divide-y divide-stone-100">
              {product.variants.map((variant) => (
                <li key={variant.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-stone-700">
                    {variant.name} — {formatCents(variant.price)}
                    {variant.isActive ? null : <span className="ml-1.5 text-stone-400">(inactive)</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => void toggleVariantActive(variant.id, variant.isActive)}
                    className={`text-xs font-medium ${variant.isActive ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                  >
                    {variant.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-stone-800">Modifiers</h3>
            <ul className="mb-4 space-y-2">
              {allModifiers.map((modifier) => (
                <li key={modifier.id}>
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={selectedModifierIds.has(modifier.id)}
                      onChange={() => toggleModifierSelection(modifier.id)}
                      className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                    />
                    {modifier.name} — {formatCents(modifier.price)}
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void handleSaveModifiers()}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Save modifiers
            </button>
          </div>
        </>
      ) : null}
    </section>
  )
}
