import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateExpression } from '../src/calculator.js';
import { createDotnetCalculator } from '../src/dotnet.js';

test('initializes one .NET WASM runtime and calls real C# exports', async () => {
  const [calculator, second] = await Promise.all([createDotnetCalculator(), createDotnetCalculator()]);
  assert.equal(calculator, second);
  assert.equal(calculator.multiply(6, 7), 42);
  assert.equal(calculator.divide(9, 4), 2.25);
  assert.equal(calculator.power(2, 10), 1024);
  assert.equal(calculator.sqrt(81), 9);
  assert.equal(calculator.factorial(0), 1);
  assert.equal(calculator.factorial(10), 3628800);
  assert.ok(Number.isFinite(calculator.factorial(170)));
  assert.equal(evaluateExpression('sqrt(81) + 2 * 3', calculator), 15);
  assert.equal(evaluateExpression('pow(2, 3) + factorial(5) / 10', calculator), 20);
});

test('C# exceptions cross the WASM boundary and later calls still work', async () => {
  const calculator = await createDotnetCalculator();
  assert.throws(() => calculator.divide(1, 0), /divide by zero/i);
  assert.throws(() => calculator.sqrt(-1), /non-negative/i);
  for (const value of [-1, 0.5, 171]) {
    assert.throws(() => calculator.factorial(value), /integer between 0 and 170/i);
  }
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => calculator.multiply(value, 2), /finite numbers/i);
  }
  assert.throws(() => calculator.multiply(1e308, 10), /finite real number range/i);
  assert.throws(() => calculator.power(-1, 0.5), /finite real number range/i);
  assert.equal(calculator.multiply(7, 8), 56);
});
