/** Чистые хелперы (без сети) — можно импортировать на клиенте. */

export const CALENDAR_TZ = 'Asia/Yekaterinburg';
export const DONE_SUMMARY_PREFIX = '(Done)';

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

function dtstampUtc(now: Date = new Date()): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildVeventIcs(params: {
  eventUid: string;
  summary: string;
  description: string | null;
  startAt: string;
  endAt: string;
}): string {
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
    'BEGIN:VEVENT',
    `UID:${params.eventUid}`,
    `DTSTAMP:${dtstampUtc()}`,
    `DTSTART;TZID=${CALENDAR_TZ}:${isoToIcsLocal(params.startAt)}`,
    `DTEND;TZID=${CALENDAR_TZ}:${isoToIcsLocal(params.endAt)}`,
    `SUMMARY:${escapeIcsText(params.summary)}`,
  ];
  if (params.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(params.description.trim())}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export type ParsedEvent = {
  uid: string | null;
  summary: string | null;
  description: string | null;
  startAt: string | null;
  endAt: string | null;
  rawIcs: string;
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

export function parseVeventIcs(ics: string): ParsedEvent {
  const lines = unfoldIcs(ics);
  let uid: string | null = null;
  let summary: string | null = null;
  let description: string | null = null;
  let startAt: string | null = null;
  let endAt: string | null = null;
  let inEvent = false;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      continue;
    }
    if (line === 'END:VEVENT') {
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

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
      case 'DTSTART':
        startAt = parseIcsDateValue(value);
        break;
      case 'DTEND':
        endAt = parseIcsDateValue(value);
        break;
      default:
        break;
    }
  }

  return { uid, summary, description, startAt, endAt, rawIcs: ics };
}

/** Нормализация: «(Done)» / «(Done) » в начале SUMMARY */
export function hasDonePrefix(summary: string): boolean {
  return /^\(\s*Done\s*\)/i.test(summary.trim());
}

/**
 * FR-4: если префикс уже есть — не дублировать;
 * иначе SUMMARY = "(Done) " + имя узла.
 */
export function buildDoneSummary(currentSummary: string | null, nodeName: string): string {
  if (currentSummary && hasDonePrefix(currentSummary)) {
    return currentSummary.trim().replace(/^\(\s*Done\s*\)\s*/i, `${DONE_SUMMARY_PREFIX} `);
  }
  const name = nodeName.trim() || 'Без названия';
  return `${DONE_SUMMARY_PREFIX} ${name}`;
}

/** Заменяет SUMMARY внутри VEVENT, остальные поля сохраняет. */
export function replaceIcsSummary(ics: string, newSummary: string): string {
  const lines = unfoldIcs(ics);
  const out: string[] = [];
  let inEvent = false;
  let replaced = false;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      out.push(line);
      continue;
    }
    if (line === 'END:VEVENT') {
      if (inEvent && !replaced) {
        out.push(`SUMMARY:${escapeIcsText(newSummary)}`);
        replaced = true;
      }
      inEvent = false;
      out.push(line);
      continue;
    }
    if (inEvent) {
      const colon = line.indexOf(':');
      const name = colon === -1 ? '' : line.slice(0, colon).split(';')[0].toUpperCase();
      if (name === 'SUMMARY') {
        out.push(`SUMMARY:${escapeIcsText(newSummary)}`);
        replaced = true;
        continue;
      }
      if (name === 'DTSTAMP') {
        out.push(`DTSTAMP:${dtstampUtc()}`);
        continue;
      }
    }
    out.push(line);
  }

  return out.join('\r\n');
}

export type SyncNodeSnapshot = {
  id: string;
  calendarUid: string;
  calendarSyncStopped?: boolean;
};

export type SyncPatch = {
  calendarUid?: string | null;
  calendarStartAt?: string | null;
  calendarEndAt?: string | null;
  calendarSyncedAt?: string | null;
  deadline?: string | null;
};

export type SyncNodeResult = {
  id: string;
  ok: boolean;
  skipped?: boolean;
  warning?: string;
  error?: string;
  patch?: SyncPatch;
};

/** Патч sync только даты/времени (AC-3) — без status/description. */
export function buildSyncResultFromEvent(
  node: SyncNodeSnapshot,
  event: { found: false } | { found: true; parsed: ParsedEvent },
  syncedAt: string
): SyncNodeResult {
  if (node.calendarSyncStopped) {
    return {
      id: node.id,
      ok: true,
      skipped: true,
      warning: 'sync остановлен (Done)',
    };
  }

  if (!event.found) {
    return {
      id: node.id,
      ok: true,
      warning: 'встреча не найдена в календаре',
      patch: {
        calendarUid: null,
        calendarSyncedAt: syncedAt,
      },
    };
  }

  const { parsed } = event;
  const patch: SyncPatch = {
    calendarUid: node.calendarUid,
    calendarSyncedAt: syncedAt,
  };
  if (parsed.startAt) {
    patch.calendarStartAt = parsed.startAt;
    patch.deadline = isoToDeadlineDate(parsed.startAt);
  }
  if (parsed.endAt) {
    patch.calendarEndAt = parsed.endAt;
  }

  return {
    id: node.id,
    ok: true,
    patch,
  };
}
