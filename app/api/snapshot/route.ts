import { NextResponse } from 'next/server';
import { runSnapshot } from '@/lib/snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const result = await runSnapshot();
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, stderr: result.stderr },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, stdout: result.stdout });
}
