import {
  appendCompletedNote,
  hasCompletedNote,
  parseVtodoIcs,
  isTodoCompleted,
  localYekaterinburgToIso,
  isoToDeadlineDate,
  buildVtodoIcs,
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
