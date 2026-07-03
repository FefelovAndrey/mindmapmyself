import fs from 'fs/promises';
import path from 'path';
import { MindMapDocumentSchema, type MindNode } from '../types/node';

const DATA_FILE = path.join(process.cwd(), 'data', 'mindmap.json');

function migrateNode(node: MindNode): { node: MindNode; updated: number } {
  let updated = node.status === null ? 1 : 0;
  const children = node.children.map((child) => {
    const result = migrateNode(child);
    updated += result.updated;
    return result.node;
  });

  return {
    node: {
      ...node,
      status: node.status ?? 'New',
      children,
    },
    updated,
  };
}

async function main() {
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  const parsed = MindMapDocumentSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    console.error('Invalid mindmap.json:', parsed.error.flatten());
    process.exit(1);
  }

  const { node: root, updated } = migrateNode(parsed.data.root);
  if (updated === 0) {
    console.log('No nodes with null status — nothing to migrate.');
    return;
  }

  const doc = {
    ...parsed.data,
    updatedAt: new Date().toISOString(),
    root,
  };

  await fs.writeFile(DATA_FILE, JSON.stringify(doc, null, 2) + '\n', 'utf-8');
  console.log(`Migrated ${updated} node(s): status null → New`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
