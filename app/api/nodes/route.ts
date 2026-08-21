import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { MindMapDocumentSchema, type MindMapDocument } from '@/types/node';

const DATA_FILE = path.join(process.cwd(), 'data', 'mindmap.json');

function createDefaultDocument(): MindMapDocument {
  return {
    version: '1.0',
    updatedAt: new Date().toISOString(),
    root: {
      id: randomUUID(),
      name: 'задачи RULI',
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
    },
  };
}

async function ensureDataFile(): Promise<MindMapDocument> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = MindMapDocumentSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch (err) {
    const isMissing = err instanceof Error && 'code' in err && err.code === 'ENOENT';
    if (!isMissing) throw err;
  }

  const document = createDefaultDocument();
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(document, null, 2), 'utf-8');
  return document;
}

export async function GET() {
  try {
    const data = await ensureDataFile();
    // #region agent log
    const logLine = JSON.stringify({sessionId:'70051d',location:'app/api/nodes/route.ts:GET',message:'GET success',data:{rootId:data.root.id,rootName:data.root.name,runId:'post-fix'},timestamp:Date.now(),hypothesisId:'A-fix'}) + '\n';
    await fs.appendFile(path.join(process.cwd(), '.cursor', 'debug-70051d.log'), logLine).catch(() => {});
    // #endregion
    return NextResponse.json(data);
  } catch (err) {
    // #region agent log
    const logLine = JSON.stringify({sessionId:'70051d',location:'app/api/nodes/route.ts:GET',message:'read failed',data:{file:DATA_FILE,error:err instanceof Error?err.message:String(err),runId:'post-fix'},timestamp:Date.now(),hypothesisId:'A'}) + '\n';
    await fs.appendFile(path.join(process.cwd(), '.cursor', 'debug-70051d.log'), logLine).catch(() => {});
    // #endregion
    return NextResponse.json(
      { error: 'Failed to read data file' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = MindMapDocumentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const document = {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(DATA_FILE, JSON.stringify(document, null, 2), 'utf-8');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: 'Failed to save data' },
      { status: 500 }
    );
  }
}
