import { Check, Circle, Loader2 } from 'lucide-react'
import type { SequenceStepProgress } from '@/lib/engagementSequence'
import { cn } from '@/lib/utils'

interface SequenceProgressFlowProps {
  steps: SequenceStepProgress[]
  isComplete: boolean
  autoSending?: boolean
  compact?: boolean
}

export function SequenceProgressFlow({
  steps,
  isComplete,
  autoSending = false,
  compact = false,
}: SequenceProgressFlowProps) {
  const displaySteps = isComplete
    ? steps.map((item) => ({ ...item, state: 'complete' as const }))
    : steps

  return (
    <div className={cn('flex items-start', compact ? 'gap-0' : 'gap-0.5')}>
      {displaySteps.map((item, index) => (
        <div key={item.step.id} className="flex items-center">
          <div className="flex flex-col items-center gap-0.5">
            <StepNode
              state={item.state}
              label={item.step.shortLabel}
              isAutoSending={autoSending && item.state === 'pending'}
            />
            {!compact && (
              <span className="max-w-[2.5rem] truncate text-center text-[9px] leading-tight text-muted-foreground">
                {item.step.label}
              </span>
            )}
          </div>
          {index < displaySteps.length - 1 && (
            <div
              className={cn(
                'mx-0.5 mt-2 h-px w-3 shrink-0 sm:w-4',
                item.state === 'complete' ? 'bg-green-300' : 'bg-border',
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function StepNode({
  state,
  label,
  isAutoSending,
}: {
  state: SequenceStepProgress['state']
  label: string
  isAutoSending: boolean
}) {
  if (state === 'complete') {
    return (
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-green-700"
        title={`${label}: done`}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      </div>
    )
  }

  if (state === 'pending') {
    return (
      <div
        className="flex h-7 min-w-[2.75rem] flex-col items-center justify-center rounded-full bg-amber-100 px-1 text-amber-800"
        title={`${label}: pending`}
      >
        {isAutoSending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <span className="text-[9px] font-semibold leading-none">Pending</span>
        )}
      </div>
    )
  }

  return (
    <div
      className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-slate-200 bg-slate-50 text-slate-300"
      title={`${label}: not started`}
    >
      <Circle className="h-2 w-2" fill="currentColor" strokeWidth={0} />
    </div>
  )
}
