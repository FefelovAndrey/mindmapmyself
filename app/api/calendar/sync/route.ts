import { NextResponse } from 'next/server';
import type { Status } from '@/types/node';
import {
  getTodo,
  buildSyncResultFromTodo,
  type SyncNodeResult,
} from '@/lib/yandexCalendar';

type SyncNodeIn = {
  id: string;
  calendarUid: string;
  description: string | null;
  status: Status | null;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nodes: SyncNodeIn[] = Array.isArray(body.nodes) ? body.nodes : [];
    const syncedAt = new Date().toISOString();
    const now = new Date();
    const results: SyncNodeResult[] = [];

    for (const node of nodes) {
      if (!node?.id || !node?.calendarUid) {
        results.push({ id: node?.id ?? '', ok: false, error: 'Нет calendarUid' });
        continue;
      }

      try {
        const got = await getTodo(node.calendarUid);
        results.push(
          buildSyncResultFromTodo(
            {
              id: node.id,
              calendarUid: node.calendarUid,
              description: node.description,
              status: node.status,
            },
            got,
            syncedAt,
            now
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

    return NextResponse.json({
      results,
      summary: {
        successCount: results.filter((r) => r.ok && !r.warning).length,
        warningCount: results.filter((r) => r.ok && r.warning).length,
        errorCount: results.filter((r) => !r.ok).length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка синхронизации';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
