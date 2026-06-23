import { z } from 'zod';

export const StatusEnum = z.enum(['New', 'Done', 'Cancelled']);
export type Status = z.infer<typeof StatusEnum>;

export const MindNodeSchema: z.ZodType<MindNode> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().max(2000).nullable(),
    responsible: z.string().nullable(),
    status: StatusEnum.nullable(),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    children: z.array(MindNodeSchema),
  })
);

export interface MindNode {
  id: string;
  name: string;
  description: string | null;
  responsible: string | null;
  status: Status | null;
  deadline: string | null;
  children: MindNode[];
}

export const MindMapDocumentSchema = z.object({
  version: z.string(),
  updatedAt: z.string(),
  root: MindNodeSchema,
});

export type MindMapDocument = z.infer<typeof MindMapDocumentSchema>;
