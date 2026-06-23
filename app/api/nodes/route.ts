import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { MindMapDocumentSchema } from '@/types/node';

const DATA_FILE = path.join(process.cwd(), 'data', 'mindmap.json');

export async function GET() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
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
