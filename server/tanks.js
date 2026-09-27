import { EventEmitter } from 'node:events'
import { measureDistance } from './ultrasonic.js'

// Distance to the water surface (mm) as a percentage full
export function percentFull(tank, rawMm) {
  const pct = ((tank.empty - rawMm) * 100) / (tank.empty - tank.full)
  return Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10
}

export class Tanks extends EventEmitter {
  constructor({ tanks, hosts, store, log, now = Date.now }) {
    super()
    this.tanks = tanks
    this.store = store
    this.log = log
    this.hosts = hosts
    this.now = now
    this.measuring = null
  }

  // Measure every tank. Concurrent calls share the one in progress.
  measure() {
    this.measuring ??= this.#measureAll().finally(() => { this.measuring = null })
    return this.measuring
  }

  async #measureAll() {
    // One timestamp per round so tanks line up on the chart
    const ts = this.now()
    for (const tank of this.tanks) {
      try {
        const rawMm = await measureDistance(this.hosts[tank.sensor.host], tank.sensor)
        this.store.addReading(tank.id, ts, rawMm)
      } catch (err) {
        this.log(`${tank.name}: measurement failed (${err.message.split('\n')[0]})`)
      }
    }
    this.log('Measured tank levels')
    this.emit('change')
  }

  snapshot() {
    return this.tanks.map((tank) => {
      const latest = this.store.latestReading(tank.id)
      return {
        id: tank.id,
        name: tank.name,
        percent: latest ? percentFull(tank, latest.rawMm) : null,
        ts: latest?.ts ?? null,
      }
    })
  }

  // History for the last `hours` (0 = everything), averaged down to at most ~maxPoints per tank
  history(hours, maxPoints = 400) {
    const now = this.now()
    const from = hours > 0 ? now - hours * 3_600_000 : (this.store.firstReadingTs() ?? now)
    const bucketMs = Math.max(3_600_000, Math.ceil((now - from) / maxPoints / 3_600_000) * 3_600_000)
    const byTank = Object.fromEntries(this.tanks.map((t) => [t.id, []]))
    const tankById = Object.fromEntries(this.tanks.map((t) => [t.id, t]))
    for (const row of this.store.history(from, bucketMs)) {
      if (tankById[row.tankId]) byTank[row.tankId].push([row.ts, percentFull(tankById[row.tankId], row.rawMm)])
    }
    return { from, bucketMs, tanks: this.tanks.map((t) => ({ id: t.id, name: t.name, points: byTank[t.id] })) }
  }
}
