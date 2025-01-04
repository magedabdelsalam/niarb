export function objectToCSV(data: Record<string, any>[]): string {
  if (data.length === 0) return ''

  const headers = Object.keys(data[0])
  const rows = data.map(obj => headers.map(header => obj[header]))

  return [
    headers.join(','),
    ...rows.map(row => row.map(value => {
      if (value === null || value === undefined) return ''
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }).join(','))
  ].join('\\n')
}

export function parseCSV(csv: string): Record<string, any>[] {
  const lines = csv.split('\\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim())
  const rows = lines.slice(1)

  return rows.map(row => {
    const values = row.split(',').map(v => v.trim())
    return headers.reduce((obj, header, i) => {
      obj[header] = values[i]
      return obj
    }, {} as Record<string, any>)
  })
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
} 