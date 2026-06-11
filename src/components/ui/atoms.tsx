import { cn, initials, avatarColor } from '@/lib/utils'

// ── Badge ──────────────────────────────────────────────────────
interface BadgeProps {
  className?: string
  children: React.ReactNode
}
export function Badge({ className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-transparent px-2.5 py-0.5 text-xs font-medium shadow-sm',
        className,
      )}
    >
      {children}
    </span>
  )
}

// ── Avatar ─────────────────────────────────────────────────────
interface AvatarProps {
  name: string
  size?: number
}
export function Avatar({ name, size = 32 }: AvatarProps) {
  const color = avatarColor(name)
  return (
    <div
      className={cn('flex items-center justify-center rounded-full font-medium flex-shrink-0', color)}
      style={{ width: size, height: size, fontSize: size * 0.375 }}
    >
      {initials(name)}
    </div>
  )
}

// ── ProgressBar ────────────────────────────────────────────────
interface ProgressBarProps {
  value: number
  className?: string
}
export function ProgressBar({ value, className }: ProgressBarProps) {
  return (
    <div className={cn('h-2 w-full rounded-full bg-secondary overflow-hidden', className)}>
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

// ── EmptyState ─────────────────────────────────────────────────
interface EmptyStateProps {
  message: string
}
export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

// ── SectionHeader ──────────────────────────────────────────────
interface SectionHeaderProps {
  title: string
  count?: number
  action?: React.ReactNode
}
export function SectionHeader({ title, count, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-lg font-medium flex items-center gap-2">
        {title}
        {count !== undefined && (
          <span className="text-sm font-normal text-muted-foreground">{count}</span>
        )}
      </h1>
      {action}
    </div>
  )
}
