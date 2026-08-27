export type CsvRow = (string | number)[]

// RFC 4180-ish: quote every cell and double up embedded quotes. Always
// quoting (not just when a comma/quote is present) keeps this simple and
// is still valid CSV that Excel and Google Sheets both parse correctly.
export function buildCsv(headers: string[], rows: CsvRow[]): string {
  const lines = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  return lines.join('\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportCsv(filename: string, headers: string[], rows: CsvRow[]): void {
  downloadCsv(filename, buildCsv(headers, rows))
}

// Both filenames and Google Sheets sheet names choke on `/`; today's date
// keeps repeated exports from overwriting each other in a downloads folder.
export function dateStampedFilename(base: string): string {
  return `${base}-${new Date().toISOString().slice(0, 10)}.csv`
}
