import { z } from 'zod';

export const StatusEnum = z.enum(['New', 'Done', 'Cancelled']);
export type Status = z.infer<typeof StatusEnum>;

export const PrioritySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Priority = z.infer<typeof PrioritySchema>;

/** Старые карты без поля priority → null. Значение вне 1–3 отклоняется. */
const optionalPriority = z
  .union([PrioritySchema, z.null()])
  .optional()
  .transform((v) => v ?? null);

/** Старые карты без календарных полей → null / false */
const nullableString = z
  .string()
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const optionalBoolFalse = z
  .boolean()
  .optional()
  .transform((v) => v ?? false);

export const MindNodeSchema: z.ZodType<MindNode> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().max(2000).nullable(),
    responsible: z.string().nullable(),
    status: StatusEnum.nullable(),
    priority: optionalPriority,
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    calendarUid: nullableString,
    calendarStartAt: nullableString,
    calendarEndAt: nullableString,
    calendarSyncedAt: nullableString,
    calendarSyncStopped: optionalBoolFalse,
    children: z.array(MindNodeSchema),
  })
) as z.ZodType<MindNode>;

export interface MindNode {
  id: string;
  name: string;
  description: string | null;
  responsible: string | null;
  status: Status | null;
  priority: Priority | null;
  deadline: string | null;
  calendarUid: string | null;
  calendarStartAt: string | null;
  calendarEndAt: string | null;
  calendarSyncedAt: string | null;
  calendarSyncStopped: boolean;
  children: MindNode[];
}

export interface ResponsibleEntry {
  name: string;
  active: boolean;
}

const ResponsibleEntrySchema = z.object({
  name: z.string().min(1),
  active: z.boolean(),
});

function assignedNames(node: MindNode): string[] {
  const names = new Set<string>();
  const walk = (n: MindNode) => {
    const name = n.responsible?.trim();
    if (name) names.add(name);
    n.children.forEach(walk);
  };
  walk(node);
  return Array.from(names);
}

/** Нет поля — имена с узлов, все активные. Имя на узле, которого нет в списке, добавляется активным. */
export function normalizeResponsibles(
  root: MindNode,
  entries: ResponsibleEntry[] | undefined
): ResponsibleEntry[] {
  const byName = new Map<string, ResponsibleEntry>();
  for (const entry of entries ?? []) {
    const name = entry.name.trim();
    if (!name || byName.has(name)) continue;
    byName.set(name, { name, active: entry.active });
  }
  for (const name of assignedNames(root)) {
    if (!byName.has(name)) byName.set(name, { name, active: true });
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export const MindMapDocumentSchema = z
  .object({
    version: z.string(),
    updatedAt: z.string(),
    root: MindNodeSchema,
    responsibles: z.array(ResponsibleEntrySchema).optional(),
  })
  .transform((doc) => ({
    version: doc.version,
    updatedAt: doc.updatedAt,
    root: doc.root,
    responsibles: normalizeResponsibles(doc.root, doc.responsibles),
  }));

export type MindMapDocument = z.infer<typeof MindMapDocumentSchema>;
