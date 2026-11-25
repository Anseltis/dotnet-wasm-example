import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { evaluateExpression } from './calculator.js';
import { createDotnetCalculator } from './dotnet.js';

const help = `TypeScript + C# WebAssembly calculator

Usage:
  npm start -- "sqrt(81) + 2 * 3"
  npm start

Operators: + - * / ^, parentheses, unary + and -
Functions: sqrt(x), pow(base, exponent), factorial(n)
Numbers: integers, decimals, and scientific notation (1.5e2)

TypeScript handles parsing, +, and -.
C# WebAssembly handles *, /, ^, and the functions above.
In the interactive console, use help or exit.
`;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    console.log(help);
    return;
  }

  const backend = await createDotnetCalculator();
  if (args.length > 0) {
    console.log(evaluateExpression(args.join(' '), backend));
    return;
  }

  const terminal = Boolean(stdin.isTTY && stdout.isTTY);
  const reader = createInterface({ input: stdin, output: stdout, terminal });
  if (terminal) console.log('TypeScript + C# WASM calculator. Type help or exit.');
  const prompt = (): void => { if (terminal) reader.prompt(); };
  reader.setPrompt('calc> ');
  prompt();

  try {
    for await (const input of reader) {
      const expression = input.trim();
      if (expression === 'exit' || expression === 'quit') break;
      if (expression === 'help' || expression === '?') {
        console.log(help);
      } else if (expression.length > 0) {
        try {
          console.log(evaluateExpression(expression, backend));
        } catch (error) {
          console.error(`Error: ${message(error)}`);
        }
      }
      prompt();
    }
  } finally {
    reader.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Error: ${message(error)}`);
  process.exitCode = 1;
});
