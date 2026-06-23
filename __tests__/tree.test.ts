import {
  calcNumbers,
  addChild,
  addSiblingAfter,
  addSiblingBefore,
  removeNode,
  filterTree,
  type FilterState,
} from '../hooks/useTree';
import type { MindNode } from '../types/node';

function makeNode(id: string, name: string, children: MindNode[] = []): MindNode {
  return { id, name, description: null, responsible: null, status: null, deadline: null, children };
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
    const map = filterTree(treeWithAttrs, { responsible: 'Андрей', status: null });
    expect(map.get('a')?.matched).toBe(true);
    expect(map.get('d')?.matched).toBe(true);
    expect(map.get('c')?.matched).toBe(false);
  });

  test('filter by status returns matching nodes', () => {
    const map = filterTree(treeWithAttrs, { responsible: null, status: 'Done' });
    expect(map.get('c')?.matched).toBe(true);
    expect(map.get('d')?.matched).toBe(true);
    expect(map.get('a')?.matched).toBe(false);
  });

  test('AND filter: both conditions must match', () => {
    const map = filterTree(treeWithAttrs, { responsible: 'Андрей', status: 'Done' });
    expect(map.get('d')?.matched).toBe(true);
    expect(map.get('a')?.matched).toBe(false); // Андрей/New — не совпадает по статусу
  });

  test('parent with matching descendant has hasMatchingDescendant=true', () => {
    const map = filterTree(treeWithAttrs, { responsible: 'Роман', status: null });
    expect(map.get('b')?.hasMatchingDescendant).toBe(true);
    expect(map.get('b')?.matched).toBe(false);
  });
});
