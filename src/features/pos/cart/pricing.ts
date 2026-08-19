export function calcLineTotal(unitPrice: number, modifierPrices: number[], quantity: number): number {
  const modifierTotal = modifierPrices.reduce((sum, price) => sum + price, 0)
  return (unitPrice + modifierTotal) * quantity
}
