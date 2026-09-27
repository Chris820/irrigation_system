// A schedule is a weekly window: { days: [0-6, Sunday = 0], start: 'HH:MM', durationMin }.
// Times are the Pi's local time. Windows may run past midnight.

// The occurrence of the schedule on the calendar day `offset` days from `now`.
// Built from calendar fields (not +24h) so daylight saving changes are handled.
function occurrence(schedule, now, offset) {
  const today = new Date(now)
  const [h, m] = schedule.start.split(':').map(Number)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, h, m)
  if (!schedule.days.includes(start.getDay())) return null
  return { start: start.getTime(), end: start.getTime() + schedule.durationMin * 60_000 }
}

// The window containing `now`, if any
export function activeWindow(schedule, now) {
  for (const offset of [0, -1]) {
    const w = occurrence(schedule, now, offset)
    if (w && w.start <= now && now < w.end) return w
  }
  return null
}

// The next window starting after `now`, if any
export function nextWindow(schedule, now) {
  for (let offset = 0; offset <= 7; offset++) {
    const w = occurrence(schedule, now, offset)
    if (w && w.start > now) return w
  }
  return null
}

export class Scheduler {
  constructor({ store, zones, log, now = Date.now }) {
    this.store = store
    this.zones = zones
    this.log = log
    this.now = now
    // Windows already started (or deliberately skipped), so a manual stop is
    // not immediately undone on the next tick. Keyed by `${scheduleId}@${start}`.
    this.handled = new Map()
  }

  pausedUntil() {
    const until = this.store.getSetting('pausedUntil')
    return until && until > this.now() ? until : null
  }

  async tick() {
    const now = this.now()
    const paused = this.pausedUntil()
    for (const schedule of this.store.schedules()) {
      if (!schedule.enabled) continue
      const w = activeWindow(schedule, now)
      if (!w) continue
      const key = `${schedule.id}@${w.start}`
      if (this.handled.has(key)) continue
      this.handled.set(key, w.end)
      if (paused) {
        this.log(`Skipped scheduled ${this.zones.get(schedule.zoneId).name} run (schedules paused)`)
        continue
      }
      const zone = this.zones.get(schedule.zoneId)
      if (zone.run && zone.run.until >= w.end) continue
      await this.zones.start(schedule.zoneId, { until: w.end, source: 'schedule' })
    }
    for (const [key, end] of this.handled) {
      if (end < now) this.handled.delete(key)
    }
  }

  // Next scheduled start per zone, for display
  upcoming() {
    const now = this.now()
    const next = {}
    for (const s of this.store.schedules()) {
      if (!s.enabled) continue
      const w = nextWindow(s, now)
      if (w && (!next[s.zoneId] || w.start < next[s.zoneId].start)) next[s.zoneId] = w
    }
    return next
  }
}

export function validateSchedule(body, zoneIds, maxRunMinutes) {
  const { zoneId, days, start, durationMin, enabled = true } = body ?? {}
  const errors = []
  if (!zoneIds.includes(zoneId)) errors.push('unknown zone')
  if (!Array.isArray(days) || !days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) errors.push('days must be 0-6')
  if (typeof start !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) errors.push('start must be HH:MM')
  if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > maxRunMinutes) errors.push(`duration must be 1-${maxRunMinutes} minutes`)
  if (errors.length) throw Object.assign(new Error(errors.join(', ')), { status: 400 })
  // Monday-first order (Sunday stays 0, as in Date.getDay())
  const mondayFirst = (a, b) => ((a + 6) % 7) - ((b + 6) % 7)
  return { zoneId, days: [...new Set(days)].sort(mondayFirst), start, durationMin, enabled: !!enabled }
}
