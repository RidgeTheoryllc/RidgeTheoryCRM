export function buildLinkedInSearchUrl(lead: {
  name: string
  title?: string | null
  company_name?: string | null
}): string | null {
  const name = lead.name?.trim()
  if (!name) return null

  const company = lead.company_name?.trim()
  const title = lead.title?.trim()

  let keywords: string
  if (company && title) {
    keywords = `${name} ${company} ${title}`
  } else if (company) {
    keywords = `${name} ${company}`
  } else {
    keywords = name
  }

  const encoded = encodeURIComponent(keywords.replace(/\s+/g, ' ').trim())
  return `https://www.linkedin.com/search/results/people/?keywords=${encoded}`
}
