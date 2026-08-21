import { v4 as uuidv4 } from 'uuid';
import type { MindNode, Status } from '@/types/node';

export interface NumberedNode extends MindNode {
  number: string;
  children: NumberedNode[];
}

/** Вычисляет иерархические номера для всего дерева */
export function calcNumbers(node: MindNode, prefix = ''): NumberedNode {
  const number = prefix || '1';
  return {
    ...node,
    number,
    children: node.children.map((child, i) =>
      calcNumbers(child, `${number}.${i + 1}`)
    ),
  };
}

/** Создаёт новый пустой узел */
function newNode(name = 'Новый узел'): MindNode {
  return {
    id: uuidv4(),
    name,
    description: null,
    responsible: null,
    status: 'New',
    deadline: null,
    calendarUid: null,
    calendarStartAt: null,
    calendarEndAt: null,
    calendarSyncedAt: null,
    calendarSyncStopped: false,
    children: [],
  };
}

/** Находит родителя узла по id */
export function findParent(
  root: MindNode,
  targetId: string
): { parent: MindNode; index: number } | null {
  for (let i = 0; i < root.children.length; i++) {
    if (root.children[i].id === targetId) {
      return { parent: root, index: i };
    }
    const found = findParent(root.children[i], targetId);
    if (found) return found;
  }
  return null;
}

/** Находит узел по id */
export function findNode(root: MindNode, id: string): MindNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

/** Добавляет дочерний узел */
export function addChild(root: MindNode, parentId: string): { tree: MindNode; newId: string } {
  const node = newNode();
  const updated = addChildMutate(structuredClone(root), parentId, node);
  return { tree: updated, newId: node.id };
}

function addChildMutate(root: MindNode, parentId: string, node: MindNode): MindNode {
  if (root.id === parentId) {
    return { ...root, children: [...root.children, node] };
  }
  return {
    ...root,
    children: root.children.map((c) => addChildMutate(c, parentId, node)),
  };
}

/** Добавляет соседний узел ПОСЛЕ текущего */
export function addSiblingAfter(
  root: MindNode,
  targetId: string
): { tree: MindNode; newId: string } | null {
  if (root.id === targetId) return null; // корень — нет родителя
  const node = newNode();
  const updated = addSiblingAfterMutate(structuredClone(root), targetId, node);
  if (!updated) return null;
  return { tree: updated, newId: node.id };
}

function addSiblingAfterMutate(
  root: MindNode,
  targetId: string,
  node: MindNode
): MindNode | null {
  const idx = root.children.findIndex((c) => c.id === targetId);
  if (idx !== -1) {
    const children = [...root.children];
    children.splice(idx + 1, 0, node);
    return { ...root, children };
  }
  const newChildren = root.children.map((c) => addSiblingAfterMutate(c, targetId, node));
  if (newChildren.some((c) => c !== null)) {
    return { ...root, children: newChildren.map((c, i) => c ?? root.children[i]) };
  }
  return null;
}

/** Добавляет соседний узел ПЕРЕД текущим */
export function addSiblingBefore(
  root: MindNode,
  targetId: string
): { tree: MindNode; newId: string } | null {
  if (root.id === targetId) return null;
  const node = newNode();
  const updated = addSiblingBeforeMutate(structuredClone(root), targetId, node);
  if (!updated) return null;
  return { tree: updated, newId: node.id };
}

function addSiblingBeforeMutate(
  root: MindNode,
  targetId: string,
  node: MindNode
): MindNode | null {
  const idx = root.children.findIndex((c) => c.id === targetId);
  if (idx !== -1) {
    const children = [...root.children];
    children.splice(idx, 0, node);
    return { ...root, children };
  }
  const newChildren = root.children.map((c) => addSiblingBeforeMutate(c, targetId, node));
  if (newChildren.some((c) => c !== null)) {
    return { ...root, children: newChildren.map((c, i) => c ?? root.children[i]) };
  }
  return null;
}

/** Удаляет узел (корень удалить нельзя) */
export function removeNode(
  root: MindNode,
  targetId: string
): MindNode {
  if (root.id === targetId) return root; // защита корня
  return {
    ...root,
    children: root.children
      .filter((c) => c.id !== targetId)
      .map((c) => removeNode(c, targetId)),
  };
}

/** Обновляет поля узла */
export function updateNode(
  root: MindNode,
  targetId: string,
  patch: Partial<Omit<MindNode, 'id' | 'children'>>
): MindNode {
  if (root.id === targetId) {
    return { ...root, ...patch };
  }
  return {
    ...root,
    children: root.children.map((c) => updateNode(c, targetId, patch)),
  };
}

/** Возвращает плоский список id в порядке обхода (для навигации клавишами) */
export function flatIds(node: MindNode, collapsed: Set<string>): string[] {
  const result: string[] = [node.id];
  if (!collapsed.has(node.id)) {
    for (const child of node.children) {
      result.push(...flatIds(child, collapsed));
    }
  }
  return result;
}

/** Считает всех потомков узла (без самого узла) */
export function countDescendants(node: MindNode): number {
  let total = 0;
  for (const child of node.children) {
    total += 1 + countDescendants(child);
  }
  return total;
}

/** Собирает все уникальные значения Ответственного */
export function collectResponsibles(node: MindNode): string[] {
  const set = new Set<string>();
  function traverse(n: MindNode) {
    if (n.responsible) set.add(n.responsible);
    n.children.forEach(traverse);
  }
  traverse(node);
  return Array.from(set).sort();
}

export type FilterState = {
  responsibles: string[];
  statuses: Status[];
};

export const EMPTY_FILTERS: FilterState = { responsibles: [], statuses: [] };

export function hasActiveFilters(filters: FilterState): boolean {
  return filters.responsibles.length > 0 || filters.statuses.length > 0;
}

export type FilteredNode = MindNode & {
  matched: boolean;
  visible: boolean;
};

/** Фильтрует дерево: возвращает карту id → { matched, visible } */
export function filterTree(
  node: MindNode,
  filters: FilterState
): Map<string, { matched: boolean; hasMatchingDescendant: boolean }> {
  const map = new Map<string, { matched: boolean; hasMatchingDescendant: boolean }>();

  function traverse(n: MindNode): boolean {
    const responsibleMatch =
      filters.responsibles.length === 0 ||
      (n.responsible !== null && filters.responsibles.includes(n.responsible));
    const statusMatch =
      filters.statuses.length === 0 ||
      (n.status !== null && filters.statuses.includes(n.status));
    const selfMatch = responsibleMatch && statusMatch;

    // Используем forEach чтобы обойти ВСЕХ детей (some прерывается досрочно)
    let hasMatchingDescendant = false;
    for (const child of n.children) {
      if (traverse(child)) hasMatchingDescendant = true;
    }

    map.set(n.id, { matched: selfMatch, hasMatchingDescendant });
    return selfMatch || hasMatchingDescendant;
  }

  traverse(node);
  return map;
}

/** Узел виден при активном фильтре, если сам совпадает или ведёт к совпадению ниже по дереву */
export function isNodeVisibleInFilter(
  filterMap: Map<string, { matched: boolean; hasMatchingDescendant: boolean }> | null,
  nodeId: string
): boolean {
  if (!filterMap) return true;
  const info = filterMap.get(nodeId);
  if (!info) return true;
  return info.matched || info.hasMatchingDescendant;
}
