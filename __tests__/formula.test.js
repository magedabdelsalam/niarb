import test from 'node:test'
import assert from 'node:assert/strict'

import { validateFormula, evaluateFormula } from '../src/lib/formula.js'

test('validateFormula returns valid for correct formula', () => {
  const result = validateFormula('a + b * 2', ['a', 'b'])
  assert.equal(result.isValid, true)
})

test('validateFormula detects invalid characters', () => {
  const result = validateFormula('a + b $ 2', ['a', 'b'])
  assert.equal(result.isValid, false)
  assert.equal(result.error, 'Formula contains invalid characters')
})

test('evaluateFormula uses provided context', () => {
  const value = evaluateFormula('a + b * 2', { a: 3, b: 4 })
  assert.equal(value, 11)
})
