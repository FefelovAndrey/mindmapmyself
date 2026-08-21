import {
  appendCompletedNote,
  hasCompletedNote,
  parseVtodoIcs,
  isTodoCompleted,
  localYekaterinburgToIso,
  isoToDeadlineDate,
  buildVtodoIcs,
  buildSyncResultFromTodo,
  validateTimeRange,
  MAX_DESCRIPTION,
} from '../lib/yandexCalendar/helpers';

describe('appendCompletedNote', () => {
  test('appends note to empty description', () => {
    const result = appendCompletedNote(null, new Date('2026-08-21T09:30:00+05:00'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.description).toMatch(/^Выполнена в календаре 21\.08\.2026 09:30$/);
    }
  });

  test('keeps existing description', () => {
    const result = appendCompletedNote('Текст', new Date('2026-08-21T09:30:00+05:00'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.description?.startsWith('Текст\n')).toBe(true);
      expect(result.description).toContain('Выполнена в календаре');
    }
  });

  test('idempotent — does not duplicate', () => {
    const first = appendCompletedNote('A', new Date('2026-08-21T09:30:00+05:00'));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = appendCompletedNote(first.description, new Date('2026-08-22T10:00:00+05:00'));
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.description).toBe(first.description);
      expect(hasCompletedNote(second.description)).toBe(true);
    }
  });

  test('fails when would exceed 2000 chars', () => {
    const base = 'x'.repeat(MAX_DESCRIPTION - 10);
    const result = appendCompletedNote(base, new Date('2026-08-21T09:30:00+05:00'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('2000');
    }
  });
});

describe('parseVtodoIcs', () => {
  test('parses COMPLETED status and dates', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VTODO',
      'UID:abc-123',
      'SUMMARY:Test',
      'STATUS:COMPLETED',
      'COMPLETED:20260821T043000Z',
      'DTSTART;TZID=Asia/Yekaterinburg:20260821T090000',
      'DUE;TZID=Asia/Yekaterinburg:20260821T100000',
      'END:VTODO',
      'END:VCALENDAR',
    ].join('\r\n');

    const parsed = parseVtodoIcs(ics);
    expect(parsed.uid).toBe('abc-123');
    expect(parsed.summary).toBe('Test');
    expect(isTodoCompleted(parsed)).toBe(true);
    expect(parsed.startAt).toBe('2026-08-21T09:00:00+05:00');
    expect(parsed.endAt).toBe('2026-08-21T10:00:00+05:00');
    expect(parsed.completedAt).not.toBeNull();
  });
});

describe('datetime helpers', () => {
  test('localYekaterinburgToIso and deadline date', () => {
    const iso = localYekaterinburgToIso('2026-08-21', '09:00');
    expect(iso).toBe('2026-08-21T09:00:00+05:00');
    expect(isoToDeadlineDate(iso)).toBe('2026-08-21');
  });

  test('buildVtodoIcs contains SUMMARY and times', () => {
    const ics = buildVtodoIcs({
      todoUid: 'uid-1',
      summary: 'Название',
      description: 'Описание',
      startAt: '2026-08-21T09:00:00+05:00',
      endAt: '2026-08-21T10:00:00+05:00',
    });
    expect(ics).toContain('SUMMARY:Название');
    expect(ics).toContain('DESCRIPTION:Описание');
    expect(ics).toContain('DTSTART;TZID=Asia/Yekaterinburg:20260821T090000');
    expect(ics).toContain('DUE;TZID=Asia/Yekaterinburg:20260821T100000');
    expect(ics).toContain('UID:uid-1');
  });
});

describe('validateTimeRange', () => {
  test('rejects end before or equal start', () => {
    expect(validateTimeRange('10:00', '09:00')).toMatch(/позже/);
    expect(validateTimeRange('09:00', '09:00')).toMatch(/позже/);
  });

  test('accepts end after start', () => {
    expect(validateTimeRange('09:00', '10:00')).toBeNull();
  });
});

describe('buildSyncResultFromTodo', () => {
  const node = {
    id: 'node-1',
    calendarUid: 'uid-1',
    description: 'Работа',
    status: 'New' as const,
  };

  test('updates times and deadline from calendar', () => {
    const result = buildSyncResultFromTodo(
      node,
      {
        found: true,
        parsed: {
          uid: 'uid-1',
          summary: 'X',
          description: null,
          status: 'NEEDS-ACTION',
          completedAt: null,
          startAt: '2026-08-22T11:00:00+05:00',
          endAt: '2026-08-22T12:00:00+05:00',
        },
      },
      '2026-08-21T12:00:00.000Z'
    );
    expect(result.ok).toBe(true);
    expect(result.patch?.calendarStartAt).toBe('2026-08-22T11:00:00+05:00');
    expect(result.patch?.calendarEndAt).toBe('2026-08-22T12:00:00+05:00');
    expect(result.patch?.deadline).toBe('2026-08-22');
    expect(result.patch?.status).toBe('New');
  });

  test('marks Done and appends completed note', () => {
    const result = buildSyncResultFromTodo(
      node,
      {
        found: true,
        parsed: {
          uid: 'uid-1',
          summary: 'X',
          description: null,
          status: 'COMPLETED',
          completedAt: new Date('2026-08-21T09:30:00+05:00'),
          startAt: '2026-08-21T09:00:00+05:00',
          endAt: '2026-08-21T10:00:00+05:00',
        },
      },
      '2026-08-21T12:00:00.000Z'
    );
    expect(result.ok).toBe(true);
    expect(result.patch?.status).toBe('Done');
    expect(result.patch?.description).toContain('Работа\nВыполнена в календаре');
  });

  test('uses sync moment when COMPLETED has no timestamp', () => {
    const now = new Date('2026-08-21T15:45:00+05:00');
    const result = buildSyncResultFromTodo(
      { ...node, description: null },
      {
        found: true,
        parsed: {
          uid: 'uid-1',
          summary: 'X',
          description: null,
          status: 'COMPLETED',
          completedAt: null,
          startAt: '2026-08-21T09:00:00+05:00',
          endAt: '2026-08-21T10:00:00+05:00',
        },
      },
      '2026-08-21T12:00:00.000Z',
      now
    );
    expect(result.ok).toBe(true);
    expect(result.patch?.description).toMatch(/^Выполнена в календаре 21\.08\.2026 15:45$/);
  });

  test('does not duplicate completed note', () => {
    const result = buildSyncResultFromTodo(
      { ...node, description: 'Выполнена в календаре 20.08.2026 10:00', status: 'Done' },
      {
        found: true,
        parsed: {
          uid: 'uid-1',
          summary: 'X',
          description: null,
          status: 'COMPLETED',
          completedAt: new Date('2026-08-21T09:30:00+05:00'),
          startAt: '2026-08-21T09:00:00+05:00',
          endAt: '2026-08-21T10:00:00+05:00',
        },
      },
      '2026-08-21T12:00:00.000Z'
    );
    expect(result.ok).toBe(true);
    expect(result.patch?.description).toBe('Выполнена в календаре 20.08.2026 10:00');
  });

  test('errors when note would exceed 2000 chars but keeps Done', () => {
    const result = buildSyncResultFromTodo(
      { ...node, description: 'x'.repeat(MAX_DESCRIPTION - 10) },
      {
        found: true,
        parsed: {
          uid: 'uid-1',
          summary: 'X',
          description: null,
          status: 'COMPLETED',
          completedAt: new Date('2026-08-21T09:30:00+05:00'),
          startAt: '2026-08-21T09:00:00+05:00',
          endAt: '2026-08-21T10:00:00+05:00',
        },
      },
      '2026-08-21T12:00:00.000Z'
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('2000');
    expect(result.patch?.status).toBe('Done');
    expect(result.patch?.description).toBe('x'.repeat(MAX_DESCRIPTION - 10));
  });

  test('clears binding when task not found', () => {
    const result = buildSyncResultFromTodo(node, { found: false }, '2026-08-21T12:00:00.000Z');
    expect(result.ok).toBe(true);
    expect(result.warning).toMatch(/не найдена/);
    expect(result.patch?.calendarUid).toBeNull();
    expect(result.patch?.calendarStartAt).toBeUndefined();
  });

  test('omits deadline key when startAt missing', () => {
    const result = buildSyncResultFromTodo(
      node,
      {
        found: true,
        parsed: {
          uid: 'uid-1',
          summary: 'X',
          description: null,
          status: 'NEEDS-ACTION',
          completedAt: null,
          startAt: null,
          endAt: null,
        },
      },
      '2026-08-21T12:00:00.000Z'
    );
    expect(result.ok).toBe(true);
    expect(result.patch).not.toHaveProperty('deadline');
    expect(result.patch).not.toHaveProperty('calendarStartAt');
  });
});
