// Fill the development database with a year of plausible tank readings
// and a couple of schedules, so the UI has something to show.
//   npm run seed
import config from '../server/config.js'
import { openDb } from '../server/db.js'

const store = openDb(config.dbPath)
const HOUR = 3_600_000
const now = Math.floor(Date.now() / HOUR) * HOUR

for (const [i, tank] of config.tanks.entries()) {
  const rows = []
  let level = 0.6
  for (let ts = now - 365 * 24 * HOUR; ts <= now; ts += HOUR) {
    // Slow draw-down, with the occasional downpour refilling it
    level -= 0.0006 + Math.random() * 0.0004
    if (Math.random() < 0.004) level += 0.2 + Math.random() * 0.4
    level = Math.min(1, Math.max(0.05 + i * 0.05, level))
    rows.push([ts, tank.empty - level * (tank.empty - tank.full) + (Math.random() - 0.5) * 8])
  }
  store.addReadings(tank.id, rows)
}

if (!store.schedules().length) {
  store.addSchedule({ zoneId: 'garden', days: [1, 3, 5], start: '06:30', durationMin: 20 })
  store.addSchedule({ zoneId: 'garden', days: [0, 1, 2, 3, 4, 5, 6], start: '18:00', durationMin: 10, enabled: false })
  store.addSchedule({ zoneId: 'lawn', days: [2, 6], start: '05:45', durationMin: 30 })
}
console.log(`Seeded ${config.dbPath}`)
