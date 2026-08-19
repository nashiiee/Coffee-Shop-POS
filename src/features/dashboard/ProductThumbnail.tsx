import { CupIcon } from '../admin/icons'
import { getProductImage } from '../../lib/productImages'

interface ProductThumbnailProps {
  name: string
  size?: number
}

export function ProductThumbnail({ name, size = 36 }: ProductThumbnailProps) {
  const imageSrc = getProductImage(name)

  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-lg object-cover"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"
      style={{ width: size, height: size }}
    >
      <CupIcon className="h-1/2 w-1/2" />
    </span>
  )
}
