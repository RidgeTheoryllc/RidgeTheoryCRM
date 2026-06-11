export function parseCSV(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '').trim()
  if (!input) return []

  const rows: string[][] = [[]]
  let field = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    const next = input[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      rows[rows.length - 1].push(field.trim())
      field = ''
    } else if (char === '\n') {
      rows[rows.length - 1].push(field.trim())
      rows.push([])
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  rows[rows.length - 1].push(field.trim())
  return rows.filter((row) => row.some((cell) => cell !== ''))
}

export function createCSVMapping(
  fields: string[],
  headers: string[],
): Record<string, number | ''> {
  const auto: Record<string, number | ''> = {}

  fields.forEach((field) => {
    const fieldKey = normalizeHeader(field)
    const idx = headers.findIndex((header) => {
      const headerKey = normalizeHeader(header)
      if (!headerKey) return false
      return headerKey === fieldKey || headerKey.includes(fieldKey) || fieldKey.includes(headerKey)
    })

    if (idx >= 0) auto[field] = idx
  })

  return auto
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}
