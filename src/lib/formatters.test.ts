import assert from 'node:assert/strict'
import test from 'node:test'
import {
  caretPositionForDigits,
  formatCnpj,
  formatCpf,
  formatPhone,
} from './formatters'

test('formats CPF progressively and keeps leading zeros', () => {
  assert.equal(formatCpf('0'), '0')
  assert.equal(formatCpf('0123456'), '012.345.6')
  assert.equal(formatCpf('01234567890'), '012.345.678-90')
  assert.equal(formatCpf('012.345.678-90'), '012.345.678-90')
  assert.equal(formatCpf('012345678901234'), '012.345.678-90')
})

test('formats CNPJ progressively', () => {
  assert.equal(formatCnpj('11'), '11')
  assert.equal(formatCnpj('11222333000181'), '11.222.333/0001-81')
  assert.equal(formatCnpj('11.222.333/0001-81'), '11.222.333/0001-81')
  assert.equal(formatCnpj('112223330001819999'), '11.222.333/0001-81')
})

test('formats phone progressively', () => {
  assert.equal(formatPhone('95'), '95')
  assert.equal(formatPhone('959'), '(95) 9')
  assert.equal(formatPhone('95912345678'), '(95) 91234-5678')
  assert.equal(formatPhone('(95) 91234-5678'), '(95) 91234-5678')
})

test('maps a digit count back to a caret position', () => {
  assert.equal(caretPositionForDigits('012.345.678-90', 0), 0)
  assert.equal(caretPositionForDigits('012.345.678-90', 3), 3)
  assert.equal(caretPositionForDigits('012.345.678-90', 4), 5)
  assert.equal(caretPositionForDigits('012.345.678-90', 11), 14)
  assert.equal(caretPositionForDigits('012.345.678-90', 20), 14)
})
