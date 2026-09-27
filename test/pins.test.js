import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toBcm } from '../server/pins.js'

test('physical pins map to BCM numbers', () => {
  assert.equal(toBcm(3), 2)
  assert.equal(toBcm(5), 3)
  assert.equal(toBcm(7), 4)
  assert.equal(toBcm(13), 27)
  assert.equal(toBcm(16), 23)
  assert.equal(toBcm(18), 24)
  assert.equal(toBcm(40), 21)
})

test('power and ground pins are rejected', () => {
  for (const pin of [1, 2, 4, 6, 9, 14, 17, 20, 25, 30, 34, 39, 0, 41]) {
    assert.throws(() => toBcm(pin), /not a GPIO pin/)
  }
})
