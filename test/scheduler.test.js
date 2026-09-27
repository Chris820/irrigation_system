import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openDb } from '../server/db.js'
import { mockHost } from '../server/gpio.js'
import { activeWindow, nextWindow, Scheduler, validateSchedule } from '../server/scheduler.js'
import { Zones } from '../server/zones.js'

const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime()
// 2026-09-28 is a Monday
const MON = [2026, 9, 28]

function setup(start) {
  const clock = { t: start }
  const now = () => clock.t
  const store = openDb(':memory:')
  const gpio = mockHost()
  const zones = new Zones({
    zones: [{ id: 'garden', name: 'Gardens', pin: 13, activeLow: true }],
    gpio, log: () => {}, maxRunMinutes: 180, now,
  })
  const scheduler = new Scheduler({ store, zones, log: () => {}, now })
  const tick = async () => { await scheduler.tick(); await zones.tick() }
  return { clock, store, gpio, zones, scheduler, tick }
}

test('activeWindow matches only inside the window on scheduled days', () => {
  const s = { days: [1], start: '06:00', durationMin: 30 }
  assert.equal(activeWindow(s, at(...MON, 5, 59)), null)
  assert.deepEqual(activeWindow(s, at(...MON, 6, 0)), { start: at(...MON, 6), end: at(...MON, 6, 30) })
  assert.ok(activeWindow(s, at(...MON, 6, 29)))
  assert.equal(activeWindow(s, at(...MON, 6, 30)), null)
  assert.equal(activeWindow(s, at(2026, 9, 29, 6, 10)), null) // Tuesday
})

test('windows can run past midnight', () => {
  const s = { days: [1], start: '23:50', durationMin: 20 }
  assert.ok(activeWindow(s, at(2026, 9, 29, 0, 5))) // Tuesday 00:05, started Monday
  assert.equal(activeWindow(s, at(2026, 9, 29, 0, 10)), null)
})

test('nextWindow finds the next start, wrapping the week', () => {
  const s = { days: [1], start: '06:00', durationMin: 30 }
  assert.equal(nextWindow(s, at(...MON, 7)).start, at(2026, 10, 5, 6))
  assert.equal(nextWindow(s, at(...MON, 5)).start, at(...MON, 6))
})

test('a schedule switches the zone on and off (relay is active-low)', async () => {
  const { clock, store, gpio, zones, tick } = setup(at(...MON, 5, 59))
  await zones.init()
  store.addSchedule({ zoneId: 'garden', days: [1], start: '06:00', durationMin: 30 })

  await tick()
  assert.equal(gpio.pins.get(13), 1, 'off before the window')
  clock.t = at(...MON, 6, 0, 10)
  await tick()
  assert.equal(gpio.pins.get(13), 0, 'on during the window')
  clock.t = at(...MON, 6, 30)
  await tick()
  assert.equal(gpio.pins.get(13), 1, 'off at the end')
})

test('a scheduled run resumes after a restart mid-window', async () => {
  const { store, gpio, zones, tick } = setup(at(...MON, 6, 15))
  await zones.init()
  store.addSchedule({ zoneId: 'garden', days: [1], start: '06:00', durationMin: 30 })
  await tick()
  assert.equal(gpio.pins.get(13), 0)
  assert.equal(zones.get('garden').run.until, at(...MON, 6, 30))
})

test('stopping a scheduled run manually is not undone by the next tick', async () => {
  const { clock, store, zones, tick } = setup(at(...MON, 6, 1))
  await zones.init()
  store.addSchedule({ zoneId: 'garden', days: [1], start: '06:00', durationMin: 30 })
  await tick()
  await zones.stop('garden', 'manual')
  clock.t = at(...MON, 6, 2)
  await tick()
  assert.equal(zones.isRunning('garden'), false)
})

test('paused schedules do not start', async () => {
  const { store, zones, tick } = setup(at(...MON, 6, 1))
  await zones.init()
  store.addSchedule({ zoneId: 'garden', days: [1], start: '06:00', durationMin: 30 })
  store.setSetting('pausedUntil', at(...MON, 12))
  await tick()
  assert.equal(zones.isRunning('garden'), false)
})

test('disabled schedules do not start', async () => {
  const { store, zones, tick } = setup(at(...MON, 6, 1))
  await zones.init()
  store.addSchedule({ zoneId: 'garden', days: [1], start: '06:00', durationMin: 30, enabled: false })
  await tick()
  assert.equal(zones.isRunning('garden'), false)
})

test('manual runs are capped at maxRunMinutes', async () => {
  const { clock, zones, tick } = setup(at(...MON, 6))
  await zones.init()
  await zones.start('garden', { until: clock.t + 24 * 3_600_000, source: 'manual' })
  assert.equal(zones.get('garden').run.until, clock.t + 180 * 60_000)
  clock.t += 180 * 60_000
  await tick()
  assert.equal(zones.isRunning('garden'), false)
})

test('validateSchedule rejects bad input', () => {
  const ok = { zoneId: 'garden', days: [0, 3, 1, 1], start: '06:00', durationMin: 10 }
  assert.deepEqual(validateSchedule(ok, ['garden'], 180), { ...ok, days: [1, 3, 0], enabled: true }, 'deduplicated, Monday first')
  for (const bad of [
    { ...ok, zoneId: 'nope' },
    { ...ok, days: [7] },
    { ...ok, start: '24:00' },
    { ...ok, start: '6:00' },
    { ...ok, durationMin: 0 },
    { ...ok, durationMin: 181 },
  ]) {
    assert.throws(() => validateSchedule(bad, ['garden'], 180), { status: 400 })
  }
})
