import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { runSnapshot } from '@/lib/snapshot';

describe('runSnapshot', () => {
  it('returns ok when script exits 0', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-ok-'));
    const scriptsDir = path.join(dir, 'scripts');
    await fs.mkdir(scriptsDir);
    await fs.writeFile(
      path.join(scriptsDir, 'snapshot-data.sh'),
      '#!/usr/bin/env bash\necho "ok snapshot"\nexit 0\n',
      { mode: 0o755 }
    );

    const result = await runSnapshot(dir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stdout).toContain('ok snapshot');
    }
  });

  it('returns error when script exits non-zero', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-fail-'));
    const scriptsDir = path.join(dir, 'scripts');
    await fs.mkdir(scriptsDir);
    await fs.writeFile(
      path.join(scriptsDir, 'snapshot-data.sh'),
      '#!/usr/bin/env bash\necho "boom" >&2\nexit 1\n',
      { mode: 0o755 }
    );

    const result = await runSnapshot(dir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it('returns error when script is missing', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-missing-'));
    const result = await runSnapshot(dir);
    expect(result.ok).toBe(false);
  });
});
