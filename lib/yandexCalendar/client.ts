import { buildVtodoIcs, parseVtodoIcs, type ParsedTodo } from './helpers';

export type CalendarConfig = {
  email: string;
  token: string;
  todosCalendarId: string;
};

export function getCalendarConfig(): CalendarConfig {
  const email = process.env.YANDEX_CALENDAR_EMAIL;
  const token = process.env.YANDEX_OAUTH_TOKEN;
  const todosCalendarId = process.env.YANDEX_TODOS_CALENDAR_ID || 'todos-7647328';
  if (!email || !token) {
    throw new Error('Не заданы YANDEX_CALENDAR_EMAIL / YANDEX_OAUTH_TOKEN');
  }
  return { email, token, todosCalendarId };
}

function todoUrl(cfg: CalendarConfig, todoUid: string): string {
  return `https://caldav.yandex.ru/calendars/${encodeURIComponent(cfg.email)}/${cfg.todosCalendarId}/${todoUid}.ics`;
}

export async function createTodo(params: {
  todoUid: string;
  summary: string;
  description: string | null;
  startAt: string;
  endAt: string;
}): Promise<void> {
  const cfg = getCalendarConfig();
  const body = buildVtodoIcs(params);
  const res = await fetch(todoUrl(cfg, params.todoUid), {
    method: 'PUT',
    headers: {
      Authorization: `OAuth ${cfg.token}`,
      'Content-Type': 'text/calendar; charset=utf-8',
      // Не перезаписывать существующую задачу с тем же UID
      'If-None-Match': '*',
    },
    body,
  });
  if (res.status !== 201 && res.status !== 204 && res.status !== 200) {
    const text = await res.text().catch(() => '');
    throw new Error(`CalDAV create failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
}

export async function getTodo(
  todoUid: string
): Promise<{ found: true; parsed: ParsedTodo } | { found: false }> {
  const cfg = getCalendarConfig();
  const res = await fetch(todoUrl(cfg, todoUid), {
    method: 'GET',
    headers: { Authorization: `OAuth ${cfg.token}` },
  });
  if (res.status === 404) return { found: false };
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CalDAV get failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  const ics = await res.text();
  return { found: true, parsed: parseVtodoIcs(ics) };
}
