/** Чистые хелперы (без сети) — можно импортировать на клиенте. */

export const CALENDAR_TZ = 'Asia/Yekaterinburg';
export const COMPLETED_NOTE_PREFIX = 'Выполнена в календаре';
export const MAX_DESCRIPTION = 2000;

export type AppendNoteResult =
  | { ok: true; description: string | null }
  | { ok: false; error: string };

export function formatCompletedAt(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CALENDAR_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

export function hasCompletedNote(description: string | null): boolean {
  if (!description) return false;
  return description.split(/\r?\n/).some((line) => line.trim().startsWith(COMPLETED_NOTE_PREFIX));
}

export function appendCompletedNote(
  description: string | null,
  completedAt: Date
): AppendNoteResult {
  if (hasCompletedNote(description)) {
    return { ok: true, description };
  }
  const line = `${COMPLETED_NOTE_PREFIX} ${formatCompletedAt(completedAt)}`;
  const next = description?.trim() ? `${description.trimEnd()}\n${line}` : line;
  if (next.length > MAX_DESCRIPTION) {
    return {
      ok: false,
      error: 'Не удалось добавить пометку: превышен лимит описания 2000 символов',
    };
  }
  return { ok: true, description: next };
}

export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

export function unescapeIcsText(text: string): string {
  return text
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

export function localYekaterinburgToIso(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error('Некорректные дата или время');
  }
  return `${date}T${time}:00+05:00`;
}

export function isoToDeadlineDate(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CALENDAR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isoToLocalTime(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CALENDAR_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('hour')}:${get('minute')}`;
}

export function isoToIcsLocal(iso: string): string {
  const date = isoToDeadlineDate(iso);
  const time = isoToLocalTime(iso).replace(':', '');
  return `${date.replace(/-/g, '')}T${time}00`;
}

export function buildVtodoIcs(params: {
  todoUid: string;
  summary: string;
  description: string | null;
  startAt: string;
  endAt: string;
}): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MindMap//Yandex Calendar//RU',
    'BEGIN:VTIMEZONE',
    `TZID:${CALENDAR_TZ}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0500',
    'TZOFFSETTO:+0500',
    'TZNAME:+05',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VTODO',
    `UID:${params.todoUid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${CALENDAR_TZ}:${isoToIcsLocal(params.startAt)}`,
    `DUE;TZID=${CALENDAR_TZ}:${isoToIcsLocal(params.endAt)}`,
    `SUMMARY:${escapeIcsText(params.summary)}`,
    'STATUS:NEEDS-ACTION',
  ];
  if (params.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(params.description.trim())}`);
  }
  lines.push('END:VTODO', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export type ParsedTodo = {
  uid: string | null;
  summary: string | null;
  description: string | null;
  status: string | null;
  completedAt: Date | null;
  startAt: string | null;
  endAt: string | null;
};

function unfoldIcs(ics: string): string[] {
  const raw = ics.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function parseIcsDateValue(value: string): string | null {
  if (/^\d{8}$/.test(value)) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return `${y}-${m}-${d}T00:00:00+05:00`;
  }
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    const hh = value.slice(9, 11);
    const mm = value.slice(11, 13);
    const ss = value.slice(13, 15);
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`).toISOString();
  }
  if (/^\d{8}T\d{6}$/.test(value)) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    const hh = value.slice(9, 11);
    const mm = value.slice(11, 13);
    const ss = value.slice(13, 15);
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}+05:00`;
  }
  return null;
}

export function parseVtodoIcs(ics: string): ParsedTodo {
  const lines = unfoldIcs(ics);
  let uid: string | null = null;
  let summary: string | null = null;
  let description: string | null = null;
  let status: string | null = null;
  let completedAt: Date | null = null;
  let startAt: string | null = null;
  let endAt: string | null = null;
  let inTodo = false;

  for (const line of lines) {
    if (line === 'BEGIN:VTODO') {
      inTodo = true;
      continue;
    }
    if (line === 'END:VTODO') {
      inTodo = false;
      continue;
    }
    if (!inTodo) continue;

    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const left = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const name = left.split(';')[0].toUpperCase();

    switch (name) {
      case 'UID':
        uid = value;
        break;
      case 'SUMMARY':
        summary = unescapeIcsText(value);
        break;
      case 'DESCRIPTION':
        description = unescapeIcsText(value);
        break;
      case 'STATUS':
        status = value.toUpperCase();
        break;
      case 'COMPLETED': {
        const iso = parseIcsDateValue(value);
        completedAt = iso ? new Date(iso) : null;
        break;
      }
      case 'DTSTART':
        startAt = parseIcsDateValue(value);
        break;
      case 'DUE':
        endAt = parseIcsDateValue(value);
        break;
      default:
        break;
    }
  }

  return { uid, summary, description, status, completedAt, startAt, endAt };
}

export function isTodoCompleted(parsed: ParsedTodo): boolean {
  return parsed.status === 'COMPLETED';
}

export type SyncNodeSnapshot = {
  id: string;
  calendarUid: string;
  description: string | null;
  status: 'New' | 'Done' | 'Cancelled' | null;
};

export type SyncPatch = {
  calendarUid?: string | null;
  calendarStartAt?: string | null;
  calendarEndAt?: string | null;
  calendarSyncedAt?: string | null;
  deadline?: string | null;
  status?: 'New' | 'Done' | 'Cancelled' | null;
  description?: string | null;
};

export type SyncNodeResult = {
  id: string;
  ok: boolean;
  warning?: string;
  error?: string;
  patch?: SyncPatch;
};

/** Собирает патч узла из ответа CalDAV (без сети) — для AC-3.x. */
export function buildSyncResultFromTodo(
  node: SyncNodeSnapshot,
  todo:
    | { found: false }
    | { found: true; parsed: ParsedTodo },
  syncedAt: string,
  now: Date = new Date()
): SyncNodeResult {
  if (!todo.found) {
    return {
      id: node.id,
      ok: true,
      warning: 'задача не найдена в календаре',
      patch: {
        calendarUid: null,
        calendarSyncedAt: syncedAt,
      },
    };
  }

  const { parsed } = todo;
  let status = node.status;
  let description = node.description;
  let noteError: string | undefined;

  if (isTodoCompleted(parsed)) {
    status = 'Done';
    const completedAt = parsed.completedAt ?? now;
    const note = appendCompletedNote(description, completedAt);
    if (!note.ok) {
      noteError = note.error;
    } else {
      description = note.description;
    }
  }

  const startAt = parsed.startAt;
  const endAt = parsed.endAt;
  const patch: SyncPatch = {
    calendarUid: node.calendarUid,
    calendarSyncedAt: syncedAt,
    status,
    description,
  };
  if (startAt) {
    patch.calendarStartAt = startAt;
    patch.deadline = isoToDeadlineDate(startAt);
  }
  if (endAt) {
    patch.calendarEndAt = endAt;
  }

  return {
    id: node.id,
    ok: !noteError,
    error: noteError,
    warning: noteError,
    patch,
  };
}

export function validateTimeRange(startTime: string, endTime: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return 'Некорректное время';
  }
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (eh * 60 + em <= sh * 60 + sm) {
    return 'Время окончания должно быть позже начала';
  }
  return null;
}
