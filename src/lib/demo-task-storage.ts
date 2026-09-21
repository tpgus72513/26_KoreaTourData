import { REGIONS, type ValidationTask } from './domain';

const STORAGE_KEY = 'andong-demo-validation-tasks';
export const DEMO_TASKS_CHANGED = 'andong-demo-tasks-changed';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

/** Session storage is untrusted and may contain an older or interrupted write. */
export function isValidationTask(value: unknown): value is ValidationTask {
  if (!isRecord(value)) return false;
  return text(value.id, 160)
    && REGIONS.some((region) => region.id === value.regionId)
    && text(value.title, 180) && text(value.location, 180) && text(value.question, 1000)
    && ['not-started', 'in-progress', 'completed', 'needs-improvement'].includes(String(value.status))
    && (['assignedTo', 'notes', 'result', 'relatedAction'] as const).every((key) =>
      value[key] === null || (typeof value[key] === 'string'
        && value[key].length <= ({ assignedTo: 120, notes: 4000, result: 4000, relatedAction: 180 })[key]))
    && (value.scheduledFor === null || (typeof value.scheduledFor === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(value.scheduledFor)
      && !Number.isNaN(Date.parse(value.scheduledFor))
      && new Date(value.scheduledFor).toISOString().slice(0, 10) === value.scheduledFor))
    && Array.isArray(value.checklist) && value.checklist.length <= 12
    && value.checklist.every((item) => isRecord(item) && text(item.id, 80)
      && text(item.label, 160) && typeof item.completed === 'boolean')
    && new Set(value.checklist.map((item) => item.id)).size === value.checklist.length;
}

export function readDemoTasks(fallback: ValidationTask[]): ValidationTask[] {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) && parsed.every(isValidationTask)
      && new Set(parsed.map((task) => task.id)).size === parsed.length ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeDemoTasks(tasks: ValidationTask[]): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  window.dispatchEvent(new Event(DEMO_TASKS_CHANGED));
}
