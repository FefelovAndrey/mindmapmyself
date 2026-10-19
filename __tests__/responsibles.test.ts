import { MindMapDocumentSchema, type MindMapDocument, type MindNode } from '../types/node';
import {
  addResponsible,
  renameResponsible,
  setResponsibleActive,
} from '../lib/responsibles';

const ROOT_ID = '00000000-0000-0000-0000-000000000001';
const CHILD_ID = '00000000-0000-0000-0000-000000000002';

function node(partial: Partial<MindNode> & Pick<MindNode, 'id' | 'name'>): MindNode {
  return {
    description: null,
    responsible: null,
    status: null,
    priority: null,
    deadline: null,
    calendarUid: null,
    calendarStartAt: null,
    calendarEndAt: null,
    calendarSyncedAt: null,
    calendarSyncStopped: false,
    children: [],
    ...partial,
  };
}

function parse(raw: unknown): MindMapDocument {
  const result = MindMapDocumentSchema.safeParse(raw);
  if (!result.success) throw new Error('invalid fixture');
  return result.data;
}

describe('справочник ответственных', () => {
  test('старый документ без поля собирает имена с узлов', () => {
    const doc = parse({
      version: '1.0',
      updatedAt: '2026-10-19T00:00:00Z',
      root: node({
        id: ROOT_ID,
        name: 'Корень',
        children: [
          node({ id: CHILD_ID, name: 'Дело', responsible: 'Роман' }),
        ],
      }),
    });
    expect(doc.responsibles).toEqual([{ name: 'Роман', active: true }]);
  });

  test('имя только на узле добавляется в уже существующий список', () => {
    const doc = parse({
      version: '1.0',
      updatedAt: '2026-10-19T00:00:00Z',
      responsibles: [{ name: 'Анна', active: true }],
      root: node({
        id: ROOT_ID,
        name: 'Корень',
        responsible: 'Роман',
      }),
    });
    expect(doc.responsibles.map((entry) => entry.name)).toEqual(['Анна', 'Роман']);
  });

  test('добавить нового человека', () => {
    const doc = parse({
      version: '1.0',
      updatedAt: '2026-10-19T00:00:00Z',
      responsibles: [],
      root: node({ id: ROOT_ID, name: 'Корень' }),
    });
    const result = addResponsible(doc, '  Анна  ');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.doc.responsibles).toEqual([{ name: 'Анна', active: true }]);
    }
  });

  test('повтор того же имени', () => {
    const doc = parse({
      version: '1.0',
      updatedAt: '2026-10-19T00:00:00Z',
      responsibles: [{ name: 'Роман', active: true }],
      root: node({ id: ROOT_ID, name: 'Корень' }),
    });
    const result = addResponsible(doc, 'Роман');
    expect(result).toEqual({ ok: false, error: 'duplicate' });
    expect(doc.responsibles).toHaveLength(1);
  });

  test('пустое имя', () => {
    const doc = parse({
      version: '1.0',
      updatedAt: '2026-10-19T00:00:00Z',
      responsibles: [],
      root: node({ id: ROOT_ID, name: 'Корень' }),
    });
    expect(addResponsible(doc, '   ')).toEqual({ ok: false, error: 'empty' });
  });

  test('переименование обновляет узлы', () => {
    const doc = parse({
      version: '1.0',
      updatedAt: '2026-10-19T00:00:00Z',
      responsibles: [{ name: 'Роман', active: true }],
      root: node({
        id: ROOT_ID,
        name: 'Корень',
        children: [node({ id: CHILD_ID, name: 'Дело', responsible: 'Роман' })],
      }),
    });
    const result = renameResponsible(doc, 'Роман', 'Роман К.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.doc.responsibles.map((entry) => entry.name)).toEqual(['Роман К.']);
      expect(result.doc.root.children[0].responsible).toBe('Роман К.');
    }
  });

  test('переименовать в уже существующее имя нельзя', () => {
    const doc = parse({
      version: '1.0',
      updatedAt: '2026-10-19T00:00:00Z',
      responsibles: [
        { name: 'Анна', active: true },
        { name: 'Роман', active: true },
      ],
      root: node({ id: ROOT_ID, name: 'Корень' }),
    });
    expect(renameResponsible(doc, 'Анна', 'Роман')).toEqual({ ok: false, error: 'duplicate' });
  });

  test('уже назначенное имя остаётся на узле', () => {
    const doc = parse({
      version: '1.0',
      updatedAt: '2026-10-19T00:00:00Z',
      responsibles: [{ name: 'Роман', active: true }],
      root: node({ id: ROOT_ID, name: 'Корень', responsible: 'Роман' }),
    });
    const next = setResponsibleActive(doc, 'Роман', false);
    expect(next.responsibles).toEqual([{ name: 'Роман', active: false }]);
    expect(next.root.responsible).toBe('Роман');
  });
});
