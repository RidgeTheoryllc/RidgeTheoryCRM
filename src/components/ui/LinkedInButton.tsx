'use client'

import { Linkedin } from 'lucide-react'
import { buildLinkedInSearchUrl } from '@/lib/linkedinSearch'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LinkedInButtonProps {
  lead: {
    name: string
    title?: string | null
    company_name?: string | null
  }
  className?: string
}

export function LinkedInButton({ lead, className }: LinkedInButtonProps) {
  const url = buildLinkedInSearchUrl(lead)
  if (!url) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('h-7 px-2 text-xs', className)}
      onClick={(e) => {
        e.stopPropagation()
        window.open(url, '_blank', 'noopener,noreferrer')
      }}
    >
      <Linkedin className="h-3.5 w-3.5" />
      LinkedIn
    </Button>
  )
}
