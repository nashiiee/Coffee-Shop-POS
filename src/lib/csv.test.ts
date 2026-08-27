import { describe, expect, it } from 'vitest'
import { buildCsv, dateStampedFilename } from './csv'

describe('buildCsv', () => {
  it('quotes every cell and joins rows with newlines', () => {
    const csv = buildCsv(['Name', 'Total'], [['Latte', 400]])
    expect(csv).toBe('"Name","Total"\n"Latte","400"')
  })

  it('escapes embedded quotes by doubling them', () => {
    const csv = buildCsv(['Note'], [['Say "hi"']])
    expect(csv).toBe('"Note"\n"Say ""hi"""')
  })

  it('handles commas inside a cell without breaking columns', () => {
    const csv = buildCsv(['Name'], [['Latte, Large']])
    expect(csv).toBe('"Name"\n"Latte, Large"')
  })

  it('returns just the header row when there are no data rows', () => {
    expect(buildCsv(['A', 'B'], [])).toBe('"A","B"')
  })
})

describe('dateStampedFilename', () => {
  it('appends today\'s date and a .csv extension', () => {
    const filename = dateStampedFilename('orders')
    expect(filename).toMatch(/^orders-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})
