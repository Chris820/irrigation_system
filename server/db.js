import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS readings (
      tank_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      raw_mm REAL NOT NULL,
      PRIMARY KEY (tank_id, ts)
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY,
      zone_id TEXT NOT NULL,
      days TEXT NOT NULL,
      start TEXT NOT NULL,
      duration_min INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      ts INTEGER NOT NULL,
      message TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)
  return new Store(db)
}

function transaction(db, fn) {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

const toSchedule = (row) => ({
  id: row.id,
  zoneId: row.zone_id,
  days: JSON.parse(row.days),
  start: row.start,
  durationMin: row.duration_min,
  enabled: !!row.enabled,
})

class Store {
  constructor(db) {
    this.db = db
    this.q = {
      addReading: db.prepare('INSERT OR REPLACE INTO readings (tank_id, ts, raw_mm) VALUES (?, ?, ?)'),
      latestReading: db.prepare('SELECT ts, raw_mm FROM readings WHERE tank_id = ? ORDER BY ts DESC LIMIT 1'),
      firstReadingTs: db.prepare('SELECT MIN(ts) AS ts FROM readings'),
      history: db.prepare(`
        SELECT tank_id, (ts / $bucket) * $bucket AS bucket, AVG(raw_mm) AS raw_mm
        FROM readings WHERE ts >= $from
        GROUP BY tank_id, bucket ORDER BY bucket`),
      schedules: db.prepare('SELECT * FROM schedules ORDER BY zone_id, start'),
      schedule: db.prepare('SELECT * FROM schedules WHERE id = ?'),
      addSchedule: db.prepare('INSERT INTO schedules (zone_id, days, start, duration_min, enabled) VALUES (?, ?, ?, ?, ?)'),
      updateSchedule: db.prepare('UPDATE schedules SET days = ?, start = ?, duration_min = ?, enabled = ? WHERE id = ?'),
      deleteSchedule: db.prepare('DELETE FROM schedules WHERE id = ?'),
      addEvent: db.prepare('INSERT INTO events (ts, message) VALUES (?, ?)'),
      events: db.prepare('SELECT ts, message FROM events ORDER BY id DESC LIMIT ?'),
      pruneEvents: db.prepare('DELETE FROM events WHERE id <= (SELECT MAX(id) FROM events) - ?'),
      getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
      setSetting: db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'),
    }
  }

  // --- Tank readings ---
  addReading(tankId, ts, rawMm) {
    this.q.addReading.run(tankId, ts, rawMm)
  }
  addReadings(tankId, rows) {
    transaction(this.db, () => {
      for (const [ts, rawMm] of rows) this.q.addReading.run(tankId, ts, rawMm)
    })
  }
  latestReading(tankId) {
    const row = this.q.latestReading.get(tankId)
    return row ? { ts: row.ts, rawMm: row.raw_mm } : null
  }
  firstReadingTs() {
    return this.q.firstReadingTs.get().ts
  }
  // Averaged readings in buckets of bucketMs, since `from`
  history(from, bucketMs) {
    return this.q.history.all({ bucket: bucketMs, from }).map((r) => ({ tankId: r.tank_id, ts: r.bucket, rawMm: r.raw_mm }))
  }

  // --- Schedules ---
  schedules() {
    return this.q.schedules.all().map(toSchedule)
  }
  schedule(id) {
    const row = this.q.schedule.get(id)
    return row ? toSchedule(row) : null
  }
  addSchedule({ zoneId, days, start, durationMin, enabled = true }) {
    const { lastInsertRowid } = this.q.addSchedule.run(zoneId, JSON.stringify(days), start, durationMin, enabled ? 1 : 0)
    return this.schedule(Number(lastInsertRowid))
  }
  updateSchedule(id, { days, start, durationMin, enabled }) {
    this.q.updateSchedule.run(JSON.stringify(days), start, durationMin, enabled ? 1 : 0, id)
    return this.schedule(id)
  }
  deleteSchedule(id) {
    return this.q.deleteSchedule.run(id).changes > 0
  }

  // --- Activity log ---
  addEvent(ts, message, retention) {
    this.q.addEvent.run(ts, message)
    this.q.pruneEvents.run(retention)
  }
  events(limit) {
    return this.q.events.all(limit)
  }

  // --- Settings ---
  getSetting(key) {
    const row = this.q.getSetting.get(key)
    return row ? JSON.parse(row.value) : null
  }
  setSetting(key, value) {
    this.q.setSetting.run(key, JSON.stringify(value))
  }
}
