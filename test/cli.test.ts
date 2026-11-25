import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));

function runCli(args: string[], input = '', cwd = process.cwd()) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    timeout: 30_000,
    input,
    cwd,
  });
  // A timeout also fails this assertion, proving that the WASM runtime leaves
  // the process free to exit after the calculation or the input stream ends.
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null, result.stderr);
  return result;
}

test('CLI help works without initializing the .NET runtime', () => {
  const result = runCli(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /TypeScript \+ C# WebAssembly calculator/);
  assert.match(result.stdout, /sqrt\(x\)/);
  assert.equal(result.stderr, '');
});

test('CLI evaluates a mixed TypeScript and C# expression and exits', () => {
  const result = runCli(['sqrt(81) + 2 * 3']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '15');
  assert.equal(result.stderr, '');
});

test('CLI joins expression arguments and loads WASM from an unrelated working directory', () => {
  const result = runCli(['pow(2,', '3)', '+', 'factorial(4)'], '', tmpdir());
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '32');
  assert.equal(result.stderr, '');
});

test('CLI reports syntax and C# domain errors with a nonzero exit code', () => {
  for (const [expression, expectedError] of [
    ['2 +', /Expected/],
    ['1 / 0', /Cannot divide by zero/],
  ] as const) {
    const result = runCli([expression]);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, expectedError);
  }
});

test('piped console recovers after an error and stops at exit', () => {
  const result = runCli([], '2 * 3\n1 / 0\nsqrt(81)\nexit\n999\n');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '6\n9\n');
  assert.match(result.stderr, /Cannot divide by zero/);
});

test('piped console exits naturally at EOF', () => {
  const result = runCli([], 'pow(2, 3)\n');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '8\n');
  assert.equal(result.stderr, '');
});
