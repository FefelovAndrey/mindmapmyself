import {
  buildDoneSummary,
  hasDonePrefix,
  parseVeventIcs,
  buildVeventIcs,
  buildSyncResultFromEvent,
  validateTimeRange,
  localYekaterinburgToIso,
  isoToDeadlineDate,
  replaceIcsSummary,
  DONE_SUMMARY_PREFIX,
} from '../lib/yandexCalendar/helpers';

describe('validateTimeRange', () => {
  test('rejects zero duration', () => {
    expect(validateTimeRange('09:00', '09:00')).toMatch(/позже/);
  });
  test('rejects end before start', () => {
    expect(validateTimeRange('10:00', '09:00')).toMatch(/позже/);
  });
  test('accepts valid range', () => {
    expect(validateTimeRange('09:00', '10:00')).toBeNull();
  });
});

describe('localYekaterinburgToIso / isoToDeadlineDate', () => {
  test('builds ISO with +05:00', () => {
    expect(localYekaterinburgToIso('2026-08-22', '09:30')).toBe('2026-08-22T09:30:00+05:00');
  });
  test('deadline date from start', () => {
    expect(isoToDeadlineDate('2026-08-22T09:30:00+05:00')).toBe('2026-08-22');
  });
});

describe('VEVENT ics build/parse', () => {
  test('round-trips summary and times', () => {
    const ics = buildVeventIcs({
      eventUid: 'uid-1',
      summary: 'Тест, встреча; раз',
      description: 'строка1\nстрока2',
      startAt: '2026-08-22T09:00:00+05:00',
      endAt: '2026-08-22T10:00:00+05:00',
    });
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).not.toContain('BEGIN:VTODO');
    const parsed = parseVeventIcs(ics);
    expect(parsed.uid).toBe('uid-1');
    expect(parsed.summary).toBe('Тест, встреча; раз');
    expect(parsed.description).toBe('строка1\nстрока2');
    expect(parsed.startAt).toBe('2026-08-22T09:00:00+05:00');
    expect(parsed.endAt).toBe('2026-08-22T10:00:00+05:00');
  });

  test('omits DESCRIPTION when empty', () => {
    const ics = buildVeventIcs({
      eventUid: 'uid-2',
      summary: 'X',
      description: null,
      startAt: '2026-08-22T09:00:00+05:00',
      endAt: '2026-08-22T10:00:00+05:00',
    });
    expect(ics).not.toContain('DESCRIPTION:');
  });
});

describe('Done SUMMARY prefix (FR-4)', () => {
  test('detects prefix with/without space', () => {
    expect(hasDonePrefix('(Done) Task')).toBe(true);
    expect(hasDonePrefix('(Done)Task')).toBe(true);
    expect(hasDonePrefix('(done) Task')).toBe(true);
    expect(hasDonePrefix('Task')).toBe(false);
  });

  test('builds (Done) + node name', () => {
    expect(buildDoneSummary('Meeting', 'Узел А')).toBe(`${DONE_SUMMARY_PREFIX} Узел А`);
  });

  test('does not duplicate prefix', () => {
    expect(buildDoneSummary('(Done) Old title', 'New name')).toBe(`${DONE_SUMMARY_PREFIX} Old title`);
  });

  test('replaceIcsSummary keeps DTSTART/DTEND', () => {
    const ics = buildVeventIcs({
      eventUid: 'uid-3',
      summary: 'Old',
      description: 'desc',
      startAt: '2026-08-22T09:00:00+05:00',
      endAt: '2026-08-22T10:00:00+05:00',
    });
    const updated = replaceIcsSummary(ics, '(Done) Old');
    const parsed = parseVeventIcs(updated);
    expect(parsed.summary).toBe('(Done) Old');
    expect(parsed.startAt).toBe('2026-08-22T09:00:00+05:00');
    expect(parsed.endAt).toBe('2026-08-22T10:00:00+05:00');
    expect(parsed.description).toBe('desc');
  });
});

describe('buildSyncResultFromEvent (AC-3)', () => {
  const node = { id: 'n1', calendarUid: 'uid-1', calendarSyncStopped: false };

  test('updates only date/time fields', () => {
    const result = buildSyncResultFromEvent(
      node,
      {
        found: true,
        parsed: {
          uid: 'uid-1',
          summary: 'Should not appear in patch',
          description: 'ignored',
          startAt: '2026-08-23T11:00:00+05:00',
          endAt: '2026-08-23T12:00:00+05:00',
          rawIcs: '',
        },
      },
      '2026-08-21T12:00:00.000Z'
    );
    expect(result.ok).toBe(true);
    expect(result.patch?.calendarStartAt).toBe('2026-08-23T11:00:00+05:00');
    expect(result.patch?.calendarEndAt).toBe('2026-08-23T12:00:00+05:00');
    expect(result.patch?.deadline).toBe('2026-08-23');
    expect(result.patch).not.toHaveProperty('status');
    expect(result.patch).not.toHaveProperty('description');
    expect(result.patch).not.toHaveProperty('name');
  });

  test('skips when calendarSyncStopped', () => {
    const result = buildSyncResultFromEvent(
      { ...node, calendarSyncStopped: true },
      {
        found: true,
        parsed: {
          uid: 'uid-1',
          summary: 'X',
          description: null,
          startAt: '2026-08-23T11:00:00+05:00',
          endAt: '2026-08-23T12:00:00+05:00',
          rawIcs: '',
        },
      },
      '2026-08-21T12:00:00.000Z'
    );
    expect(result.skipped).toBe(true);
    expect(result.patch).toBeUndefined();
  });

  test('clears binding on 404 without wiping local dates', () => {
    const result = buildSyncResultFromEvent(node, { found: false }, '2026-08-21T12:00:00.000Z');
    expect(result.ok).toBe(true);
    expect(result.warning).toMatch(/не найдена/);
    expect(result.patch?.calendarUid).toBeNull();
    expect(result.patch).not.toHaveProperty('calendarStartAt');
    expect(result.patch).not.toHaveProperty('deadline');
  });
});

describe('MindNode schema calendar fields (AC-5.2)', () => {
  const { MindMapDocumentSchema } = require('../types/node');

  test('old document without calendar fields loads', () => {
    const doc = {
      version: '1.0',
      updatedAt: '2026-06-23T09:00:00Z',
      root: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Root',
        description: null,
        responsible: null,
        status: null,
        deadline: null,
        children: [],
      },
    };
    const result = MindMapDocumentSchema.safeParse(doc);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.root.calendarUid).toBeNull();
      expect(result.data.root.calendarSyncStopped).toBe(false);
    }
  });
});
