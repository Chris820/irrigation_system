import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { createApp } from '../server/app.js'
import { openDb } from '../server/db.js'
import { mockHost } from '../server/gpio.js'
import { percentFull } from '../server/tanks.js'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'irrigation-'))
const HOUR = 3_600_000

const config = {
  port: 0,
  webroot: tmp,
  mock: false,
  maxRunMinutes: 180,
  tickSeconds: 3600,
  logRetention: 100,
  zones: [
    { id: 'garden', name: 'Gardens', pin: 13, activeLow: true },
    { id: 'lawn', name: 'Lawns', pin: 7, activeLow: true },
  ],
  tanks: [
    { id: 'tank1', name: 'Tank 1', full: 270, empty: 1800, sensor: { host: 'local', trigger: 23, echo: 24 } },
    { id: 'tank2', name: 'Tank 2', full: 340, empty: 1800, sensor: { host: 'tank2', trigger: 23, echo: 24 } },
  ],
}

const gpio = mockHost({ distanceMm: () => 1200 })
const tank2Host = mockHost({ distanceMm: () => 1070 })
const hosts = { local: gpio, tank2: tank2Host }
let irrigation, base
const api = async (method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, body: res.status === 204 ? null : await res.json() }
}

before(async () => {
  irrigation = await createApp({ config, store: openDb(':memory:'), hosts })
  base = `http://localhost:${await irrigation.start()}/api`
})
after(async () => {
  await irrigation.stop()
  fs.rmSync(tmp, { recursive: true })
})

test('percentFull maps distance to percentage, clamped', () => {
  const tank = { full: 270, empty: 1800 }
  assert.equal(percentFull(tank, 270), 100)
  assert.equal(percentFull(tank, 1800), 0)
  assert.equal(percentFull(tank, 1035), 50)
  assert.equal(percentFull(tank, 100), 100)
  assert.equal(percentFull(tank, 2000), 0)
})

test('measuring reads both sensors, local and remote', async () => {
  const { body } = await api('POST', '/tanks/measure')
  assert.equal(body[0].percent, percentFull(config.tanks[0], 1200))
  assert.equal(body[1].percent, percentFull(config.tanks[1], 1070))
  const history = await api('GET', '/tanks/history?hours=24')
  assert.deepEqual(history.body.tanks.map((t) => t.points.length), [1, 1])
})

test('an unreachable tank Pi is logged, not fatal', async () => {
  tank2Host.notify = async () => { throw new Error("can't reach pigpiod on tank2.local:8888 (EHOSTUNREACH)") }
  const { status, body } = await api('POST', '/tanks/measure')
  assert.equal(status, 200)
  assert.equal(body[0].percent, percentFull(config.tanks[0], 1200))
  const log = await api('GET', '/log')
  assert.match(log.body.map((e) => e.message).join('\n'), /Tank 2: measurement failed \(can't reach pigpiod on tank2.local/)
})

test('run and stop a zone', async () => {
  let res = await api('POST', '/zones/lawn/run', { minutes: 10 })
  assert.equal(res.status, 200)
  assert.equal(gpio.pins.get(7), 0)
  assert.equal(res.body.zones.find((z) => z.id === 'lawn').run.source, 'manual')
  res = await api('POST', '/zones/lawn/stop')
  assert.equal(gpio.pins.get(7), 1)
  assert.equal(res.body.zones.find((z) => z.id === 'lawn').run, null)
})

test('run validation', async () => {
  assert.equal((await api('POST', '/zones/lawn/run', { minutes: 0 })).status, 400)
  assert.equal((await api('POST', '/zones/lawn/run', { minutes: 181 })).status, 400)
  assert.equal((await api('POST', '/zones/nope/run', { minutes: 5 })).status, 404)
})

test('stop all', async () => {
  await api('POST', '/zones/lawn/run', { minutes: 10 })
  await api('POST', '/zones/garden/run', { minutes: 10 })
  await api('POST', '/stop-all')
  assert.equal(gpio.pins.get(7), 1)
  assert.equal(gpio.pins.get(13), 1)
})

test('schedule CRUD', async () => {
  const created = await api('POST', '/schedules', { zoneId: 'lawn', days: [2, 6], start: '05:45', durationMin: 30 })
  assert.equal(created.status, 201)
  const { id } = created.body
  const updated = await api('PUT', `/schedules/${id}`, { days: [2], start: '05:30', durationMin: 20, enabled: false })
  assert.deepEqual(updated.body, { id, zoneId: 'lawn', days: [2], start: '05:30', durationMin: 20, enabled: false })
  assert.equal((await api('POST', '/schedules', { zoneId: 'lawn', days: [], start: 'soon', durationMin: 5 })).status, 400)
  assert.equal((await api('DELETE', `/schedules/${id}`)).status, 204)
  assert.equal((await api('DELETE', `/schedules/${id}`)).status, 404)
})

test('pause and resume schedules', async () => {
  const until = Date.now() + 24 * HOUR
  assert.equal((await api('PUT', '/pause', { until })).body.pausedUntil, until)
  assert.equal((await api('PUT', '/pause', { until: null })).body.pausedUntil, null)
  assert.equal((await api('PUT', '/pause', { until: 5 })).status, 400)
})
