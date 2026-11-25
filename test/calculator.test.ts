import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateExpression } from '../src/calculator.js';
import type { DotnetCalculator } from '../src/dotnet.js';

function backend(calls: string[] = []): DotnetCalculator {
  return {
    multiply(a, b) { calls.push('multiply'); return a * b; },
    divide(a, b) {
      calls.push('divide');
      if (b === 0) throw new Error('Cannot divide by zero.');
      return a / b;
    },
    power(a, b) { calls.push('power'); return a ** b; },
    sqrt(value) { calls.push('sqrt'); return Math.sqrt(value); },
    factorial(value) {
      calls.push('factorial');
      if (!Number.isInteger(value) || value < 0 || value > 170) {
        throw new Error('Factorial requires an integer from 0 through 170.');
      }
      let result = 1;
      for (let factor = 2; factor <= value; factor++) result *= factor;
      return result;
    },
  };
}

test('parses precedence, grouping, decimals, and scientific notation', () => {
  const calculator = backend();
  assert.equal(evaluateExpression('2 + 3 * 4', calculator), 14);
  assert.equal(evaluateExpression('(2 + 3) * 4', calculator), 20);
  assert.equal(evaluateExpression('10 - 3 - 2', calculator), 5);
  assert.equal(evaluateExpression('12 / 3 / 2', calculator), 2);
  assert.equal(evaluateExpression(' .5 + 1.5e2 - 2E-1 ', calculator), 150.3);
});

test('powers associate to the right and bind more tightly than unary signs', () => {
  const calculator = backend();
  assert.equal(evaluateExpression('2^3^2', calculator), 512);
  assert.equal(evaluateExpression('-2^2', calculator), -4);
  assert.equal(evaluateExpression('(-2)^2', calculator), 4);
  assert.equal(evaluateExpression('2^-2', calculator), 0.25);
  assert.equal(evaluateExpression('--2 + +3', calculator), 5);
});

test('delegates multiplication, division, powers, and functions to the backend', () => {
  const calls: string[] = [];
  assert.equal(evaluateExpression('sqrt(81) + pow(2, 3) * factorial(3) / 2^2', backend(calls)), 21);
  assert.deepEqual(calls, ['sqrt', 'power', 'factorial', 'multiply', 'power', 'divide']);
  calls.length = 0;
  assert.equal(evaluateExpression('2 + 3 - 1', backend(calls)), 4);
  assert.deepEqual(calls, []);
});

test('supports nested function arguments', () => {
  assert.equal(evaluateExpression('pow(sqrt(16), 1 + 2) + factorial(0)', backend()), 65);
});

test('rejects malformed input and executable JavaScript', () => {
  for (const expression of ['', '2 +', '(1 + 2', '1 2', '2(3)', '1e', 'sqrt(1, 2)', 'pow(2)', 'sqrt()', 'pow(2,)', 'unknown(1)', 'process.exit()', '2; 3']) {
    assert.throws(() => evaluateExpression(expression, backend()), Error, expression);
  }
});

test('rejects nonfinite numbers and propagates backend domain errors', () => {
  for (const expression of ['1e309', '1e308 + 1e308', '1e308 * 10', 'pow(10, 309)', 'sqrt(-1)', '1 / 0', 'factorial(-1)', 'factorial(1.5)', 'factorial(171)']) {
    assert.throws(() => evaluateExpression(expression, backend()), Error, expression);
  }
});
