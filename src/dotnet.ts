import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** The typed API exposed to the TypeScript calculator. */
export interface DotnetCalculator {
  multiply(left: number, right: number): number;
  divide(left: number, right: number): number;
  power(value: number, exponent: number): number;
  sqrt(value: number): number;
  factorial(value: number): number;
}

/** Keep these names/signatures in sync with the C# [JSExport] methods. */
interface CalculatorExports {
  Multiply(left: number, right: number): number;
  Divide(left: number, right: number): number;
  Power(value: number, exponent: number): number;
  Sqrt(value: number): number;
  Factorial(value: number): number;
}

interface DotnetModule {
  dotnet: {
    create(): Promise<{
      getAssemblyExports(assemblyName: string): Promise<unknown>;
    }>;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function calculatorExports(exports: unknown): CalculatorExports {
  const namespace = isObject(exports) ? exports['WasmCalculator'] : undefined;
  const calculator = isObject(namespace) ? namespace['Calculator'] : undefined;
  const methods = ['Multiply', 'Divide', 'Power', 'Sqrt', 'Factorial'] as const;
  if (!isObject(calculator) || methods.some((name) => typeof calculator[name] !== 'function')) {
    throw new Error('The C# calculator exports do not match the TypeScript glue. Run dotnet build, then npm run build.');
  }
  return calculator as unknown as CalculatorExports;
}

async function loadCalculator(): Promise<DotnetCalculator> {
  // Resolved relative to dist/src/dotnet.js, independent of the working directory.
  const runtimeUrl = new URL('../wasm/_framework/dotnet.js', import.meta.url);
  try {
    await access(runtimeUrl);
  } catch {
    throw new Error(`Missing .NET WebAssembly runtime at ${fileURLToPath(runtimeUrl)}. Run dotnet build, then npm run build.`);
  }

  // This URL points to build output, so it is intentionally a dynamic import.
  const { dotnet } = await import(runtimeUrl.href) as DotnetModule;
  const runtime = await dotnet.create();
  const exports = calculatorExports(await runtime.getAssemblyExports('Calculator.dll'));

  return Object.freeze({
    multiply: (left: number, right: number) => exports.Multiply(left, right),
    divide: (left: number, right: number) => exports.Divide(left, right),
    power: (value: number, exponent: number) => exports.Power(value, exponent),
    sqrt: (value: number) => exports.Sqrt(value),
    factorial: (value: number) => exports.Factorial(value),
  });
}

let calculatorPromise: Promise<DotnetCalculator> | undefined;

/** Initialize the in-process .NET WASM runtime once and return its typed exports. */
export function createDotnetCalculator(): Promise<DotnetCalculator> {
  calculatorPromise ??= loadCalculator();
  return calculatorPromise;
}
