import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, isPast, isToday } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const AVATAR_PALETTE = [
  'bg-blue-100 text-blue-800',
  'bg-teal-100 text-teal-800',
  'bg-purple-100 text-purple-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
]

export function avatarColor(name: string): string {
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length]
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return format(new Date(d), 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

export function isOverdue(d: string | null | undefined): boolean {
  if (!d) return false
  const date = new Date(d)
  return isPast(date) && !isToday(date)
}
