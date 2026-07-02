import type { Lead, SequenceTask } from '@/types'

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getTodaysOutreachTasks(
  tasks: SequenceTask[],
  today: string = todayDateString(),
): SequenceTask[] {
  return tasks
    .filter((task) => task.status === 'pending' && task.due_date <= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.day_number - b.day_number)
}

export function getUpcomingTasks(
  tasks: SequenceTask[],
  today: string = todayDateString(),
): SequenceTask[] {
  return tasks
    .filter((task) => task.status === 'pending' && task.due_date > today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.day_number - b.day_number)
}

export function groupTasksByChannel(tasks: SequenceTask[]) {
  return {
    email: tasks.filter((task) => task.channel === 'email'),
    linkedin: tasks.filter((task) => task.channel === 'linkedin'),
    phone: tasks.filter((task) => task.channel === 'phone'),
  }
}

export function formatTaskAction(
  task: SequenceTask,
  lead?: Pick<Lead, 'name'>,
): string {
  const name = lead?.name ?? 'Unknown'
  if (task.channel === 'email') return `Email ${name}`
  if (task.channel === 'linkedin') return `LinkedIn ${name}`
  if (task.channel === 'phone') return `Phone task: ${name}`
  return `${task.title}: ${name}`
}
