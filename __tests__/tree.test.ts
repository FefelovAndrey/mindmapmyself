import {
  calcNumbers,
  addChild,
  addSiblingAfter,
  addSiblingBefore,
  removeNode,
  filterTree,
  isNodeVisibleInFilter,
  type FilterState,
} from '../hooks/useTree';
import type { MindNode } from '../types/node';

function makeNode(id: string, name: string, children: MindNode[] = []): MindNode {
  return {
    id,
    name,
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
    children,
  };
}

// Тестовое дерево:
// root
//   1.1 → alpha
//     1.1.1 → beta
//     1.1.2 → gamma
//   1.2 → delta
const root = makeNode('root', 'Root', [
  makeNode('a', 'alpha', [
    makeNode('b', 'beta'),
    makeNode('c', 'gamma'),
  ]),
  makeNode('d', 'delta'),
]);

// ──────────────────────────────────────────────────────
// F1: Схема типов
// ──────────────────────────────────────────────────────
describe('F1: zod schema validation', () => {
  const { MindMapDocumentSchema } = require('../types/node');

  test('valid document passes', () => {
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
      expect(result.data.root.priority).toBeNull();
    }
  });

  test('missing priority loads as null', () => {
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
    if (result.success) expect(result.data.root.priority).toBeNull();
  });

  test('priority outside 1-3 fails', () => {
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
        priority: 4,
        children: [],
      },
    };
    expect(MindMapDocumentSchema.safeParse(doc).success).toBe(false);
  });

  test('priority 1 passes', () => {
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
        priority: 1,
        children: [],
      },
    };
    const result = MindMapDocumentSchema.safeParse(doc);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.root.priority).toBe(1);
  });

  test('missing root fails', () => {
    const result = MindMapDocumentSchema.safeParse({ version: '1.0' });
    expect(result.success).toBe(false);
  });

  test('invalid status fails', () => {
    const doc = {
      version: '1.0',
      updatedAt: '2026-06-23T09:00:00Z',
      root: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Root',
        description: null,
        responsible: null,
        status: 'InvalidStatus',
        deadline: null,
        children: [],
      },
    };
    const result = MindMapDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });

  test('description exceeding 2000 chars fails', () => {
    const doc = {
      version: '1.0',
      updatedAt: '2026-06-23T09:00:00Z',
      root: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Root',
        description: 'x'.repeat(2001),
        responsible: null,
        status: null,
        deadline: null,
        children: [],
      },
    };
    const result = MindMapDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────
// F2: Нумерация дерева
// ──────────────────────────────────────────────────────
describe('F2: calcNumbers', () => {
  const numbered = calcNumbers(root);

  test('root gets number 1', () => {
    expect(numbered.number).toBe('1');
  });

  test('first child gets 1.1', () => {
    expect(numbered.children[0].number).toBe('1.1');
  });

  test('second child gets 1.2', () => {
    expect(numbered.children[1].number).toBe('1.2');
  });

  test('grandchildren get 1.1.1 and 1.1.2', () => {
    expect(numbered.children[0].children[0].number).toBe('1.1.1');
    expect(numbered.children[0].children[1].number).toBe('1.1.2');
  });
});

// ──────────────────────────────────────────────────────
// F4: Манипуляции с узлами
// ──────────────────────────────────────────────────────
describe('F4: addChild', () => {
  test('adds a child to a node', () => {
    const { tree, newId } = addChild(root, 'd');
    const delta = tree.children[1];
    expect(delta.children).toHaveLength(1);
    expect(delta.children[0].id).toBe(newId);
    expect(delta.children[0].name).toBe('Новый узел');
    expect(delta.children[0].status).toBe('New');
    expect(delta.children[0].priority).toBeNull();
  });

  test('does not mutate original', () => {
    addChild(root, 'd');
    expect(root.children[1].children).toHaveLength(0);
  });
});

describe('F4: addSiblingAfter', () => {
  test('adds sibling after target node', () => {
    const result = addSiblingAfter(root, 'a');
    expect(result).not.toBeNull();
    const { tree, newId } = result!;
    expect(tree.children[1].id).toBe(newId);
    expect(tree.children[2].id).toBe('d');
  });

  test('returns null for root (no parent)', () => {
    const result = addSiblingAfter(root, 'root');
    expect(result).toBeNull();
  });

  test('inserts after last child correctly', () => {
    const result = addSiblingAfter(root, 'd');
    expect(result).not.toBeNull();
    const { tree } = result!;
    expect(tree.children).toHaveLength(3);
    expect(tree.children[2].name).toBe('Новый узел');
  });
});

describe('F4: addSiblingBefore', () => {
  test('adds sibling before target', () => {
    const result = addSiblingBefore(root, 'd');
    expect(result).not.toBeNull();
    const { tree } = result!;
    expect(tree.children).toHaveLength(3);
    expect(tree.children[1].name).toBe('Новый узел');
    expect(tree.children[2].id).toBe('d');
  });

  test('returns null for root', () => {
    expect(addSiblingBefore(root, 'root')).toBeNull();
  });
});

describe('F4: removeNode', () => {
  test('removes a leaf node', () => {
    const result = removeNode(root, 'b');
    expect(result.children[0].children).toHaveLength(1);
    expect(result.children[0].children[0].id).toBe('c');
  });

  test('removes a node with children', () => {
    const result = removeNode(root, 'a');
    expect(result.children).toHaveLength(1);
    expect(result.children[0].id).toBe('d');
  });

  test('does not remove root (protection)', () => {
    const result = removeNode(root, 'root');
    expect(result.id).toBe('root');
    expect(result.children).toHaveLength(2);
  });

  test('removes all descendants', () => {
    const result = removeNode(root, 'a');
    const allIds: string[] = [];
    function collect(n: MindNode) { allIds.push(n.id); n.children.forEach(collect); }
    collect(result);
    expect(allIds).not.toContain('a');
    expect(allIds).not.toContain('b');
    expect(allIds).not.toContain('c');
  });
});

// ──────────────────────────────────────────────────────
// F5: Фильтрация
// ──────────────────────────────────────────────────────
describe('F5: filterTree', () => {
  const treeWithAttrs = makeNode('root', 'Root', [
    { ...makeNode('a', 'alpha'), responsible: 'Андрей', status: 'New' },
    makeNode('b', 'beta', [
      { ...makeNode('c', 'gamma'), responsible: 'Роман', status: 'Done' },
    ]),
    { ...makeNode('d', 'delta'), responsible: 'Андрей', status: 'Done' },
  ]);

  test('filter by responsible returns matching nodes', () => {
    const map = filterTree(treeWithAttrs, { responsibles: ['Андрей'], statuses: [], priorities: [] });
    expect(map.get('a')?.matched).toBe(true);
    expect(map.get('d')?.matched).toBe(true);
    expect(map.get('c')?.matched).toBe(false);
  });

  test('filter by status returns matching nodes', () => {
    const map = filterTree(treeWithAttrs, { responsibles: [], statuses: ['Done'], priorities: [] });
    expect(map.get('c')?.matched).toBe(true);
    expect(map.get('d')?.matched).toBe(true);
    expect(map.get('a')?.matched).toBe(false);
  });

  test('AND filter: both conditions must match', () => {
    const map = filterTree(treeWithAttrs, { responsibles: ['Андрей'], statuses: ['Done'], priorities: [] });
    expect(map.get('d')?.matched).toBe(true);
    expect(map.get('a')?.matched).toBe(false); // Андрей/New — не совпадает по статусу
  });

  test('OR within responsible: multiple values', () => {
    const map = filterTree(treeWithAttrs, { responsibles: ['Андрей', 'Роман'], statuses: [], priorities: [] });
    expect(map.get('a')?.matched).toBe(true);
    expect(map.get('c')?.matched).toBe(true);
    expect(map.get('d')?.matched).toBe(true);
  });

  test('OR within status: multiple values', () => {
    const map = filterTree(treeWithAttrs, { responsibles: [], statuses: ['New', 'Done'], priorities: [] });
    expect(map.get('a')?.matched).toBe(true);
    expect(map.get('c')?.matched).toBe(true);
    expect(map.get('d')?.matched).toBe(true);
  });

  test('empty filter arrays match all nodes', () => {
    const map = filterTree(treeWithAttrs, { responsibles: [], statuses: [], priorities: [] });
    expect(map.get('a')?.matched).toBe(true);
    expect(map.get('c')?.matched).toBe(true);
  });

  test('parent with matching descendant has hasMatchingDescendant=true', () => {
    const map = filterTree(treeWithAttrs, { responsibles: ['Роман'], statuses: [], priorities: [] });
    expect(map.get('b')?.hasMatchingDescendant).toBe(true);
    expect(map.get('b')?.matched).toBe(false);
  });

  test('isNodeVisibleInFilter hides non-matching nodes without matching descendants', () => {
    const map = filterTree(treeWithAttrs, { responsibles: ['Роман'], statuses: [], priorities: [] });
    expect(isNodeVisibleInFilter(map, 'c')).toBe(true);
    expect(isNodeVisibleInFilter(map, 'b')).toBe(true);
    expect(isNodeVisibleInFilter(map, 'a')).toBe(false);
    expect(isNodeVisibleInFilter(map, 'd')).toBe(false);
    expect(isNodeVisibleInFilter(null, 'a')).toBe(true);
  });
});

describe('F5: filterTree priority', () => {
  const priorityTree = makeNode('root', 'Корень', [
    makeNode('branch', 'Ветка', [
      { ...makeNode('urgent', 'Срочная'), priority: 1, status: 'Done' },
      { ...makeNode('sibling', 'Сосед'), priority: 2 },
    ]),
    { ...makeNode('mid', 'Средняя'), priority: 2, status: 'New' },
    { ...makeNode('low', 'Низкая'), priority: 3 },
    { ...makeNode('plain', 'Без'), priority: null, status: 'New' },
    { ...makeNode('fresh', 'Новое'), priority: 1, status: 'New' },
  ]);

  const base = { responsibles: [] as string[], statuses: [] as const };

  test('empty priority filter matches all', () => {
    const map = filterTree(priorityTree, { ...base, statuses: [], priorities: [] });
    expect(map.get('urgent')?.matched).toBe(true);
    expect(map.get('plain')?.matched).toBe(true);
    expect(map.get('low')?.matched).toBe(true);
  });

  test('checkbox 1 matches only priority 1', () => {
    const map = filterTree(priorityTree, { ...base, statuses: [], priorities: ['1'] });
    expect(map.get('urgent')?.matched).toBe(true);
    expect(map.get('fresh')?.matched).toBe(true);
    expect(map.get('sibling')?.matched).toBe(false);
    expect(map.get('plain')?.matched).toBe(false);
    expect(isNodeVisibleInFilter(map, 'sibling')).toBe(false);
  });

  test('checkboxes 1 and 2 match either', () => {
    const map = filterTree(priorityTree, { ...base, statuses: [], priorities: ['1', '2'] });
    expect(map.get('urgent')?.matched).toBe(true);
    expect(map.get('mid')?.matched).toBe(true);
    expect(map.get('sibling')?.matched).toBe(true);
    expect(map.get('low')?.matched).toBe(false);
  });

  test('none matches only nodes without priority', () => {
    const map = filterTree(priorityTree, { ...base, statuses: [], priorities: ['none'] });
    expect(map.get('plain')?.matched).toBe(true);
    expect(map.get('root')?.matched).toBe(true);
    expect(map.get('branch')?.matched).toBe(true);
    expect(map.get('urgent')?.matched).toBe(false);
    expect(isNodeVisibleInFilter(map, 'urgent')).toBe(false);
  });

  test('ancestors of priority 1 stay visible', () => {
    const map = filterTree(priorityTree, { ...base, statuses: [], priorities: ['1'] });
    expect(map.get('urgent')?.matched).toBe(true);
    expect(map.get('branch')?.matched).toBe(false);
    expect(map.get('branch')?.hasMatchingDescendant).toBe(true);
    expect(map.get('root')?.hasMatchingDescendant).toBe(true);
    expect(isNodeVisibleInFilter(map, 'root')).toBe(true);
    expect(isNodeVisibleInFilter(map, 'branch')).toBe(true);
    expect(isNodeVisibleInFilter(map, 'urgent')).toBe(true);
    expect(isNodeVisibleInFilter(map, 'sibling')).toBe(false);
  });

  test('priority 1 AND status Done', () => {
    const map = filterTree(priorityTree, {
      responsibles: [],
      statuses: ['Done'],
      priorities: ['1'],
    });
    expect(map.get('urgent')?.matched).toBe(true);
    expect(map.get('fresh')?.matched).toBe(false);
    expect(isNodeVisibleInFilter(map, 'fresh')).toBe(false);
    expect(isNodeVisibleInFilter(map, 'branch')).toBe(true);
    expect(isNodeVisibleInFilter(map, 'root')).toBe(true);
  });
});
