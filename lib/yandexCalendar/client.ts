import {
  buildVeventIcs,
  parseVeventIcs,
  replaceIcsSummary,
  type ParsedEvent,
} from './helpers';

export type CalendarConfig = {
  email: string;
  token: string;
  eventsCalendarId: string;
};

export function getCalendarConfig(): CalendarConfig {
  const email = process.env.YANDEX_CALENDAR_EMAIL;
  const token = process.env.YANDEX_OAUTH_TOKEN;
  const eventsCalendarId = process.env.YANDEX_EVENTS_CALENDAR_ID || 'events-35737546';
  if (!email || !token) {
    throw new Error('Не заданы YANDEX_CALENDAR_EMAIL / YANDEX_OAUTH_TOKEN');
  }
  return { email, token, eventsCalendarId };
}

function eventUrl(cfg: CalendarConfig, eventUid: string): string {
  return `https://caldav.yandex.ru/calendars/${encodeURIComponent(cfg.email)}/${cfg.eventsCalendarId}/${eventUid}.ics`;
}

export async function createEvent(params: {
  eventUid: string;
  summary: string;
  description: string | null;
  startAt: string;
  endAt: string;
}): Promise<void> {
  const cfg = getCalendarConfig();
  const body = buildVeventIcs(params);
  const res = await fetch(eventUrl(cfg, params.eventUid), {
    method: 'PUT',
    headers: {
      Authorization: `OAuth ${cfg.token}`,
      'Content-Type': 'text/calendar; charset=utf-8',
    },
    body,
  });
  if (res.status !== 201 && res.status !== 204 && res.status !== 200) {
    const text = await res.text().catch(() => '');
    throw new Error(`CalDAV create failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
}

export async function getEvent(
  eventUid: string
): Promise<{ found: true; parsed: ParsedEvent } | { found: false }> {
  const cfg = getCalendarConfig();
  const res = await fetch(eventUrl(cfg, eventUid), {
    method: 'GET',
    headers: { Authorization: `OAuth ${cfg.token}` },
  });
  if (res.status === 404) return { found: false };
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CalDAV get failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  const ics = await res.text();
  return { found: true, parsed: parseVeventIcs(ics) };
}

export async function updateEventSummary(
  eventUid: string,
  newSummary: string
): Promise<{ found: true; summary: string } | { found: false }> {
  const got = await getEvent(eventUid);
  if (!got.found) return { found: false };

  const cfg = getCalendarConfig();
  const body = replaceIcsSummary(got.parsed.rawIcs, newSummary);
  const res = await fetch(eventUrl(cfg, eventUid), {
    method: 'PUT',
    headers: {
      Authorization: `OAuth ${cfg.token}`,
      'Content-Type': 'text/calendar; charset=utf-8',
    },
    body,
  });
  if (res.status !== 201 && res.status !== 204 && res.status !== 200) {
    const text = await res.text().catch(() => '');
    throw new Error(`CalDAV update failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  return { found: true, summary: newSummary };
}
