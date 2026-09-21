import type {
  RegionId,
  ValidationChecklistItem,
  ValidationTask,
  ValidationTaskStatus,
} from './domain';
import { getAdminSessionFromCookie, verifyAdminSession } from './auth';
import { getDatabase, type DatabaseRow } from './db';

export type TaskInput = Omit<ValidationTask, 'id'>;

export type TaskValidationResult =
  | { ok: true; value: TaskInput }
  | { ok: false; error: '요청 형식이 올바르지 않습니다.' };

const REGION_IDS: readonly RegionId[] = [
  'old-town-wolyeonggyo',
  'hahoemaeul',
  'dosan-yekki',
];

const STATUSES: readonly ValidationTaskStatus[] = [
  'not-started',
  'in-progress',
  'completed',
  'needs-improvement',
];

const INVALID: TaskValidationResult = { ok: false, error: '요청 형식이 올바르지 않습니다.' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function optionalText(value: unknown, maxLength: number): value is string | null {
  return value === null || (typeof value === 'string' && value.length <= maxLength);
}

function isDateOrNull(value: unknown): value is string | null {
  if (value === null) {
    return true;
  }
  if (typeof value !== 'string') {
    return false;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseChecklist(value: unknown): ValidationChecklistItem[] | null {
  if (!Array.isArray(value) || value.length > 12) {
    return null;
  }

  const items: ValidationChecklistItem[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      !requiredText(item.id, 80) ||
      !requiredText(item.label, 160) ||
      typeof item.completed !== 'boolean' ||
      Object.keys(item).some((key) => !['id', 'label', 'completed'].includes(key))
    ) {
      return null;
    }
    items.push({ id: item.id, label: item.label, completed: item.completed });
  }
  return items;
}

export function parseTaskInput(value: unknown): TaskValidationResult {
  if (!isRecord(value)) {
    return INVALID;
  }

  const allowed = [
    'regionId',
    'title',
    'location',
    'question',
    'status',
    'assignedTo',
    'scheduledFor',
    'notes',
    'result',
    'relatedAction',
    'checklist',
  ];
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    return INVALID;
  }

  if (
    !REGION_IDS.includes(value.regionId as RegionId) ||
    !requiredText(value.title, 180) ||
    !requiredText(value.location, 180) ||
    !requiredText(value.question, 1000) ||
    !STATUSES.includes(value.status as ValidationTaskStatus) ||
    !optionalText(value.assignedTo ?? null, 120) ||
    !isDateOrNull(value.scheduledFor ?? null) ||
    !optionalText(value.notes ?? null, 4000) ||
    !optionalText(value.result ?? null, 4000) ||
    !optionalText(value.relatedAction ?? null, 180)
  ) {
    return INVALID;
  }

  const checklist = parseChecklist(value.checklist ?? []);
  if (!checklist) {
    return INVALID;
  }

  return {
    ok: true,
    value: {
      regionId: value.regionId as RegionId,
      title: value.title.trim(),
      location: value.location.trim(),
      question: value.question.trim(),
      status: value.status as ValidationTaskStatus,
      assignedTo: (value.assignedTo ?? null) as string | null,
      scheduledFor: (value.scheduledFor ?? null) as string | null,
      notes: (value.notes ?? null) as string | null,
      result: (value.result ?? null) as string | null,
      relatedAction: (value.relatedAction ?? null) as string | null,
      checklist,
    },
  };
}

type TaskRow = DatabaseRow & {
  id: unknown;
  region_id: unknown;
  title: unknown;
  location: unknown;
  question: unknown;
  status: unknown;
  assigned_to: unknown;
  scheduled_for: unknown;
  notes: unknown;
  result: unknown;
  related_action: unknown;
  checklist: unknown;
};

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return typeof value === 'string' ? value : null;
}

function asChecklist(value: unknown): ValidationChecklistItem[] {
  const candidate = typeof value === 'string' ? tryParse(value) : value;
  return parseChecklist(candidate) ?? [];
}

function tryParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function mapTask(row: TaskRow): ValidationTask {
  return {
    id: String(row.id),
    regionId: row.region_id as RegionId,
    title: String(row.title),
    location: String(row.location),
    question: String(row.question),
    status: row.status as ValidationTaskStatus,
    assignedTo: asNullableString(row.assigned_to),
    scheduledFor: asNullableString(row.scheduled_for),
    notes: asNullableString(row.notes),
    result: asNullableString(row.result),
    relatedAction: asNullableString(row.related_action),
    checklist: asChecklist(row.checklist),
  };
}

const taskColumns = `
  id, region_id, title, location, question, status, assigned_to,
  scheduled_for, notes, result, related_action, checklist
`;

export async function listPersistedTasks(): Promise<ValidationTask[]> {
  const result = await getDatabase().query<TaskRow>(
    `SELECT ${taskColumns} FROM validation_tasks ORDER BY scheduled_for NULLS LAST, created_at DESC`,
  );
  return result.rows.map(mapTask);
}

export type AdminTaskReadResult =
  | { authorized: false; tasks: []; failed: false }
  | { authorized: true; tasks: ValidationTask[]; failed: boolean };

/** Keeps persisted field-work details out of unauthenticated server responses. */
export async function listPersistedTasksForAdmin(
  cookieHeader: string | null,
): Promise<AdminTaskReadResult> {
  if (!(await verifyAdminSession(getAdminSessionFromCookie(cookieHeader)))) {
    return { authorized: false, tasks: [], failed: false };
  }

  try {
    return { authorized: true, tasks: await listPersistedTasks(), failed: false };
  } catch {
    return { authorized: true, tasks: [], failed: true };
  }
}

export async function createPersistedTask(input: TaskInput): Promise<ValidationTask> {
  const result = await getDatabase().query<TaskRow>(
    `INSERT INTO validation_tasks (
       region_id, title, location, question, status, assigned_to, scheduled_for,
       notes, result, related_action, checklist
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
     RETURNING ${taskColumns}`,
    [
      input.regionId,
      input.title,
      input.location,
      input.question,
      input.status,
      input.assignedTo,
      input.scheduledFor,
      input.notes,
      input.result,
      input.relatedAction,
      JSON.stringify(input.checklist),
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Task insert did not return a row');
  }
  return mapTask(row);
}

export async function updatePersistedTask(id: string, input: TaskInput): Promise<ValidationTask | null> {
  const result = await getDatabase().query<TaskRow>(
    `UPDATE validation_tasks
     SET region_id = $1, title = $2, location = $3, question = $4, status = $5,
         assigned_to = $6, scheduled_for = $7, notes = $8, result = $9,
         related_action = $10, checklist = $11::jsonb, updated_at = NOW()
     WHERE id = $12::uuid
     RETURNING ${taskColumns}`,
    [
      input.regionId,
      input.title,
      input.location,
      input.question,
      input.status,
      input.assignedTo,
      input.scheduledFor,
      input.notes,
      input.result,
      input.relatedAction,
      JSON.stringify(input.checklist),
      id,
    ],
  );
  return result.rows[0] ? mapTask(result.rows[0]) : null;
}
