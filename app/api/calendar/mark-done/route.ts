import { NextResponse } from 'next/server';
import {
  getEvent,
  updateEventSummary,
  buildDoneSummary,
} from '@/lib/yandexCalendar';

/**
 * FR-4: при status → Done пометить SUMMARY встречи префиксом (Done)
 * и вернуть calendarSyncStopped=true только при успехе CalDAV.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const calendarUid = typeof body.calendarUid === 'string' ? body.calendarUid : '';
    const nodeName = typeof body.name === 'string' ? body.name : '';

    if (!calendarUid) {
      return NextResponse.json({ error: 'Нет calendarUid' }, { status: 400 });
    }

    const got = await getEvent(calendarUid);
    if (!got.found) {
      return NextResponse.json(
        {
          error: 'Встреча не найдена в календаре',
          calendarUid: null,
        },
        { status: 404 }
      );
    }

    const summary = buildDoneSummary(got.parsed.summary, nodeName);
    await updateEventSummary(calendarUid, summary);

    return NextResponse.json({
      ok: true,
      summary,
      calendarSyncStopped: true,
      calendarSyncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка пометки Done';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
