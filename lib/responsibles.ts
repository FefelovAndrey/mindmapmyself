import type { MindMapDocument, MindNode, ResponsibleEntry } from '@/types/node';

export type DirectoryError = 'empty' | 'duplicate';

export type DirectoryResult =
  | { ok: true; doc: MindMapDocument }
  | { ok: false; error: DirectoryError };

function sortEntries(entries: ResponsibleEntry[]): ResponsibleEntry[] {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function replaceName(node: MindNode, from: string, to: string): MindNode {
  return {
    ...node,
    responsible: node.responsible === from ? to : node.responsible,
    children: node.children.map((child) => replaceName(child, from, to)),
  };
}

export function addResponsible(doc: MindMapDocument, raw: string): DirectoryResult {
  const name = raw.trim();
  if (!name) return { ok: false, error: 'empty' };
  if (doc.responsibles.some((entry) => entry.name === name)) {
    return { ok: false, error: 'duplicate' };
  }
  return {
    ok: true,
    doc: {
      ...doc,
      responsibles: sortEntries([...doc.responsibles, { name, active: true }]),
    },
  };
}

export function renameResponsible(
  doc: MindMapDocument,
  from: string,
  raw: string
): DirectoryResult {
  const name = raw.trim();
  if (!name) return { ok: false, error: 'empty' };
  if (!doc.responsibles.some((entry) => entry.name === from)) {
    return { ok: true, doc };
  }
  if (name !== from && doc.responsibles.some((entry) => entry.name === name)) {
    return { ok: false, error: 'duplicate' };
  }
  if (name === from) return { ok: true, doc };
  return {
    ok: true,
    doc: {
      ...doc,
      root: replaceName(doc.root, from, name),
      responsibles: sortEntries(
        doc.responsibles.map((entry) => (entry.name === from ? { ...entry, name } : entry))
      ),
    },
  };
}

export function setResponsibleActive(
  doc: MindMapDocument,
  name: string,
  active: boolean
): MindMapDocument {
  return {
    ...doc,
    responsibles: doc.responsibles.map((entry) =>
      entry.name === name ? { ...entry, active } : entry
    ),
  };
}
