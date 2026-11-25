import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('the dist folder runs independently with no dotnet executable on PATH', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wasm-calculator-deploy-'));
  try {
    const app = join(directory, 'app');
    const dist = fileURLToPath(new URL('../', import.meta.url));
    await cp(dist, app, { recursive: true });
    assert.equal(JSON.parse(await readFile(join(app, 'package.json'), 'utf8')).type, 'module');
    const result = spawnSync(process.execPath, [join(app, 'src/cli.js'), '(sqrt(81) + 2) * 3'], {
      cwd: directory,
      env: { ...process.env, PATH: '' },
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), '33');
    assert.equal(result.stderr, '');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
