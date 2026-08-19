export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
}

export function dollarsToCents(pesos: string): number {
  return Math.round(Number(pesos) * 100)
}

export function formatOrderNumber(sequenceNumber: number): string {
  return `#${String(sequenceNumber).padStart(6, '0')}`
}
