import { NextResponse } from 'next/server';
import {
  getEvent,
  buildSyncResultFromEvent,
  type SyncNodeResult,
} from '@/lib/yandexCalendar';

type SyncNodeIn = {
  id: string;
  calendarUid: string;
  calendarSyncStopped?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nodes: SyncNodeIn[] = Array.isArray(body.nodes) ? body.nodes : [];
    const syncedAt = new Date().toISOString();
    const results: SyncNodeResult[] = [];

    for (const node of nodes) {
      if (!node?.id || !node?.calendarUid) {
        results.push({ id: node?.id ?? '', ok: false, error: 'Нет calendarUid' });
        continue;
      }

      if (node.calendarSyncStopped) {
        results.push(
          buildSyncResultFromEvent(
            { id: node.id, calendarUid: node.calendarUid, calendarSyncStopped: true },
            { found: false },
            syncedAt
          )
        );
        continue;
      }

      try {
        const got = await getEvent(node.calendarUid);
        results.push(
          buildSyncResultFromEvent(
            { id: node.id, calendarUid: node.calendarUid, calendarSyncStopped: false },
            got,
            syncedAt
          )
        );
      } catch (err) {
        results.push({
          id: node.id,
          ok: false,
          error: err instanceof Error ? err.message : 'Ошибка sync',
        });
      }
    }

    const skippedCount = results.filter((r) => r.skipped).length;
    const successCount = results.filter((r) => r.ok && !r.warning && !r.skipped).length;
    const warningCount = results.filter((r) => r.ok && r.warning && !r.skipped).length;
    const errorCount = results.filter((r) => !r.ok).length;

    return NextResponse.json({
      results,
      summary: {
        successCount,
        warningCount,
        skippedCount,
        errorCount,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка синхронизации';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
