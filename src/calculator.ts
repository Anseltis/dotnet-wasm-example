import type { DotnetCalculator } from './dotnet.js';

type Token = {
  kind: 'number' | 'identifier' | 'symbol' | 'end';
  text: string;
  position: number;
};

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;

  while (position < expression.length) {
    const remaining = expression.slice(position);
    const whitespace = /^\s+/.exec(remaining);
    if (whitespace) {
      position += whitespace[0].length;
      continue;
    }

    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(remaining);
    const identifier = /^[A-Za-z_][A-Za-z_\d]*/.exec(remaining);
    const text = number?.[0] ?? identifier?.[0] ?? remaining[0]!;
    if (!number && !identifier && !'+-*/^(),'.includes(text)) {
      throw new Error(`Unexpected character '${text}' at position ${position + 1}.`);
    }

    tokens.push({ kind: number ? 'number' : identifier ? 'identifier' : 'symbol', text, position });
    position += text.length;
  }

  tokens.push({ kind: 'end', text: '', position: expression.length });
  return tokens;
}

function finite(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('The calculation must produce a finite number.');
  }
  return value;
}

/** Parse an arithmetic expression; selected operations cross the C# WASM boundary. */
export function evaluateExpression(expression: string, backend: DotnetCalculator): number {
  const tokens = tokenize(expression);
  let index = 0;

  function current(): Token {
    return tokens[index]!;
  }

  function take(text: string): boolean {
    if (current().text !== text || current().kind === 'end') return false;
    index++;
    return true;
  }

  function expect(text: string): void {
    if (!take(text)) {
      throw new Error(`Expected '${text}' at position ${current().position + 1}.`);
    }
  }

  function sum(): number {
    let value = product();
    while (true) {
      if (take('+')) value = finite(value + product());
      else if (take('-')) value = finite(value - product());
      else return value;
    }
  }

  function product(): number {
    let value = unary();
    while (true) {
      if (take('*')) value = finite(backend.multiply(value, unary()));
      else if (take('/')) value = finite(backend.divide(value, unary()));
      else return value;
    }
  }

  function unary(): number {
    if (take('+')) return unary();
    if (take('-')) return -unary();
    return power();
  }

  function power(): number {
    const value = primary();
    // Parsing the exponent as a unary expression makes ^ right-associative,
    // allows 2^-2, and gives exponentiation precedence over a leading minus.
    return take('^') ? finite(backend.power(value, unary())) : value;
  }

  function primary(): number {
    const token = current();
    if (token.kind === 'number') {
      index++;
      return finite(Number(token.text));
    }

    if (take('(')) {
      const value = sum();
      expect(')');
      return value;
    }

    if (token.kind === 'identifier') {
      index++;
      const arity = token.text === 'pow' ? 2 : ['sqrt', 'factorial'].includes(token.text) ? 1 : undefined;
      if (arity === undefined) throw new Error(`Unknown function '${token.text}'.`);
      expect('(');
      const args: number[] = [];
      if (!take(')')) {
        args.push(sum());
        while (take(',')) args.push(sum());
        expect(')');
      }
      if (args.length !== arity) {
        throw new Error(`${token.text}() expects ${arity} argument${arity === 1 ? '' : 's'}.`);
      }
      switch (token.text) {
        case 'sqrt': return finite(backend.sqrt(args[0]!));
        case 'factorial': return finite(backend.factorial(args[0]!));
        case 'pow': return finite(backend.power(args[0]!, args[1]!));
      }
    }

    throw new Error(`Expected a number, function, or '(' at position ${token.position + 1}.`);
  }

  const result = sum();
  if (current().kind !== 'end') {
    throw new Error(`Unexpected token '${current().text}' at position ${current().position + 1}.`);
  }
  return finite(result);
}
