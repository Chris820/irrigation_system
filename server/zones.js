import { EventEmitter } from 'node:events'

// Owns the sprinkler relays. Every run has an end time, and `tick()` both
// switches off anything past its end time and re-asserts every pin, so a missed
// timer or a restart can never leave a solenoid open.
export class Zones extends EventEmitter {
  constructor({ zones, gpio, log, maxRunMinutes, now = Date.now }) {
    super()
    this.gpio = gpio
    this.log = log
    this.maxRunMs = maxRunMinutes * 60_000
    this.now = now
    this.zones = new Map(zones.map((z) => [z.id, { ...z, run: null }]))
  }

  async init() {
    for (const zone of this.zones.values()) {
      await this.gpio.write(zone.pin, this.level(zone, false))
    }
  }

  level(zone, on) {
    return zone.activeLow ? !on : on
  }

  get(id) {
    const zone = this.zones.get(id)
    if (!zone) throw Object.assign(new Error(`Unknown zone "${id}"`), { status: 404 })
    return zone
  }

  // Start (or extend) a run. `until` is capped at maxRunMinutes from now.
  async start(id, { until, source }) {
    const zone = this.get(id)
    const now = this.now()
    until = Math.min(until, now + this.maxRunMs)
    if (until <= now) return
    const wasOn = !!zone.run
    await this.gpio.write(zone.pin, this.level(zone, true))
    zone.run = { startedAt: wasOn ? zone.run.startedAt : now, until, source }
    const mins = Math.round((until - now) / 60_000)
    this.log(`${zone.name} ${wasOn ? 'extended' : 'on'} for ${mins} min (${source})`)
    this.emit('change')
  }

  async stop(id, reason) {
    const zone = this.get(id)
    const wasOn = !!zone.run
    zone.run = null
    await this.gpio.write(zone.pin, this.level(zone, false))
    if (wasOn) {
      this.log(`${zone.name} off (${reason})`)
      this.emit('change')
    }
  }

  async stopAll(reason) {
    for (const id of this.zones.keys()) await this.stop(id, reason)
  }

  isRunning(id) {
    return !!this.get(id).run
  }

  async tick() {
    const now = this.now()
    for (const zone of this.zones.values()) {
      if (zone.run && zone.run.until <= now) {
        await this.stop(zone.id, zone.run.source === 'schedule' ? 'schedule finished' : 'timer finished')
      } else {
        await this.gpio.write(zone.pin, this.level(zone, !!zone.run))
      }
    }
  }

  snapshot() {
    return [...this.zones.values()].map(({ id, name, icon, run }) => ({ id, name, icon, run }))
  }
}
