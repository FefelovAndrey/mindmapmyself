import { NextResponse } from 'next/server';
import type { Status } from '@/types/node';
import {
  getTodo,
  isTodoCompleted,
  appendCompletedNote,
  isoToDeadlineDate,
} from '@/lib/yandexCalendar';

type SyncNodeIn = {
  id: string;
  calendarUid: string;
  description: string | null;
  status: Status | null;
};

export type SyncPatch = {
  calendarUid?: string | null;
  calendarStartAt?: string | null;
  calendarEndAt?: string | null;
  calendarSyncedAt?: string | null;
  deadline?: string | null;
  status?: Status | null;
  description?: string | null;
};

type SyncNodeOut = {
  id: string;
  ok: boolean;
  warning?: string;
  error?: string;
  patch?: SyncPatch;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nodes: SyncNodeIn[] = Array.isArray(body.nodes) ? body.nodes : [];
    const syncedAt = new Date().toISOString();
    const results: SyncNodeOut[] = [];

    for (const node of nodes) {
      if (!node?.id || !node?.calendarUid) {
        results.push({ id: node?.id ?? '', ok: false, error: 'Нет calendarUid' });
        continue;
      }

      try {
        const got = await getTodo(node.calendarUid);
        if (!got.found) {
          results.push({
            id: node.id,
            ok: true,
            warning: 'задача не найдена в календаре',
            patch: {
              calendarUid: null,
              calendarSyncedAt: syncedAt,
            },
          });
          continue;
        }

        const { parsed } = got;
        let status: Status | null = node.status;
        let description = node.description;
        let noteError: string | undefined;

        if (isTodoCompleted(parsed)) {
          status = 'Done';
          const completedAt = parsed.completedAt ?? new Date();
          const note = appendCompletedNote(description, completedAt);
          if (!note.ok) {
            noteError = note.error;
          } else {
            description = note.description;
          }
        }

        const startAt = parsed.startAt;
        const endAt = parsed.endAt;

        results.push({
          id: node.id,
          ok: !noteError,
          error: noteError,
          warning: noteError,
          patch: {
            calendarUid: node.calendarUid,
            calendarStartAt: startAt,
            calendarEndAt: endAt,
            calendarSyncedAt: syncedAt,
            deadline: startAt ? isoToDeadlineDate(startAt) : undefined,
            status,
            description,
          },
        });
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
