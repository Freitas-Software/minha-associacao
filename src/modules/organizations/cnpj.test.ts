import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidCnpj, normalizeCnpj } from './cnpj'

test('normalizes CNPJ punctuation', () => {
  assert.equal(normalizeCnpj('11.222.333/0001-81'), '11222333000181')
  assert.equal(normalizeCnpj(' 11 222 333 0001 81 '), '11222333000181')
})

test('accepts valid CNPJ values', () => {
  assert.equal(isValidCnpj('11222333000181'), true)
  assert.equal(isValidCnpj('04.252.011/0001-10'), true)
})

test('rejects invalid CNPJ values', () => {
  assert.equal(isValidCnpj(''), false)
  assert.equal(isValidCnpj('11222333000180'), false)
  assert.equal(isValidCnpj('11111111111111'), false)
  assert.equal(isValidCnpj('123'), false)
})
