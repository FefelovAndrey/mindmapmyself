import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type SnapshotResult =
  | { ok: true; stdout: string }
  | { ok: false; error: string; stderr?: string };

/** Запускает scripts/snapshot-data.sh из корня проекта. */
export async function runSnapshot(
  cwd: string = process.cwd()
): Promise<SnapshotResult> {
  const scriptPath = path.join(cwd, 'scripts', 'snapshot-data.sh');

  try {
    const { stdout } = await execFileAsync(scriptPath, {
      cwd,
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
      env: process.env,
    });
    return { ok: true, stdout: stdout?.toString() ?? '' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stderr =
      err && typeof err === 'object' && 'stderr' in err
        ? String((err as { stderr: unknown }).stderr ?? '')
        : undefined;
    return { ok: false, error: message, stderr };
  }
}
