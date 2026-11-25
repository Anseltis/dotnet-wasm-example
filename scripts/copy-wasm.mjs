import { cp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configuration = process.env.DOTNET_CONFIGURATION || 'Debug';
const bundle = resolve(root, 'dotnet/Calculator/bin', configuration, 'net10.0/browser-wasm/AppBundle');
try {
  await stat(resolve(bundle, '_framework/dotnet.js'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const command = configuration === 'Debug' ? 'dotnet build' : `dotnet build -c ${configuration}`;
  console.error(`Missing .NET WebAssembly build output at ${bundle}. Run ${command} before npm run build.`);
  process.exit(1);
}
const destination = resolve(root, 'dist/wasm');
await mkdir(dirname(destination), { recursive: true });
await writeFile(resolve(root, 'dist/package.json'), '{"type":"module"}\n');
await rm(destination, { recursive: true, force: true });
await cp(bundle, destination, { recursive: true });
console.log(`Copied the existing ${configuration} .NET WebAssembly bundle to dist/wasm.`);
