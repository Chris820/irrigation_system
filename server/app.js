import http from 'node:http'
import express from 'express'
import { Server as SocketServer } from 'socket.io'
import { Scheduler, validateSchedule } from './scheduler.js'
import { Tanks } from './tanks.js'
import { Zones } from './zones.js'

const HOUR_MS = 3_600_000

export async function createApp({ config, store, hosts, now = Date.now }) {
  const app = express()
  const server = http.createServer(app)
  const io = new SocketServer(server)

  // Push the whole state to every client whenever something changes,
  // coalescing bursts of changes into one message
  let pending = false
  const broadcast = () => {
    if (pending) return
    pending = true
    setImmediate(() => {
      pending = false
      io.emit('state', state())
    })
  }

  const log = (message) => {
    console.log(new Date(now()).toISOString(), message)
    store.addEvent(now(), message, config.logRetention)
    broadcast()
  }

  const zones = new Zones({ zones: config.zones, gpio: hosts.local, log, maxRunMinutes: config.maxRunMinutes, now })
  const scheduler = new Scheduler({ store, zones, log, now })
  const tanks = new Tanks({ tanks: config.tanks, hosts, store, log, now })
  zones.on('change', broadcast)
  tanks.on('change', broadcast)

  const zoneIds = config.zones.map((z) => z.id)

  function state() {
    const upcoming = scheduler.upcoming()
    return {
      serverTime: now(),
      maxRunMinutes: config.maxRunMinutes,
      pausedUntil: scheduler.pausedUntil(),
      zones: zones.snapshot().map((z) => ({ ...z, next: upcoming[z.id] ?? null })),
      tanks: tanks.snapshot(),
      schedules: store.schedules(),
      log: store.events(30),
    }
  }

  io.on('connection', (socket) => socket.emit('state', state()))

  // --- API ---
  const api = express.Router()
  api.use(express.json())

  api.get('/state', (req, res) => res.json(state()))

  api.get('/tanks/history', (req, res) => {
    const hours = Math.max(0, Number(req.query.hours) || 0)
    res.json(tanks.history(hours))
  })
  api.post('/tanks/measure', async (req, res) => {
    await tanks.measure()
    res.json(tanks.snapshot())
  })

  api.post('/zones/:id/run', async (req, res) => {
    const minutes = Number(req.body?.minutes)
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > config.maxRunMinutes) {
      return res.status(400).json({ error: `minutes must be 1-${config.maxRunMinutes}` })
    }
    await zones.start(req.params.id, { until: now() + minutes * 60_000, source: 'manual' })
    res.json(state())
  })
  api.post('/zones/:id/stop', async (req, res) => {
    await zones.stop(req.params.id, 'manual')
    res.json(state())
  })
  api.post('/stop-all', async (req, res) => {
    await zones.stopAll('stop all')
    res.json(state())
  })

  api.get('/schedules', (req, res) => res.json(store.schedules()))
  api.post('/schedules', (req, res) => {
    const schedule = store.addSchedule(validateSchedule(req.body, zoneIds, config.maxRunMinutes))
    log(`Added ${zones.get(schedule.zoneId).name} schedule`)
    res.status(201).json(schedule)
  })
  api.put('/schedules/:id', (req, res) => {
    const id = Number(req.params.id)
    const existing = store.schedule(id)
    if (!existing) return res.status(404).json({ error: 'not found' })
    const schedule = store.updateSchedule(id, validateSchedule({ ...req.body, zoneId: existing.zoneId }, zoneIds, config.maxRunMinutes))
    log(`Updated ${zones.get(schedule.zoneId).name} schedule`)
    res.json(schedule)
  })
  api.delete('/schedules/:id', (req, res) => {
    const existing = store.schedule(Number(req.params.id))
    if (!existing) return res.status(404).json({ error: 'not found' })
    store.deleteSchedule(existing.id)
    log(`Removed ${zones.get(existing.zoneId).name} schedule`)
    res.status(204).end()
  })

  // Pause all schedules until a time (a "rain delay"); null resumes
  api.put('/pause', (req, res) => {
    const until = req.body?.until ?? null
    if (until !== null && !(Number.isFinite(until) && until > now())) {
      return res.status(400).json({ error: 'until must be a future timestamp or null' })
    }
    store.setSetting('pausedUntil', until)
    log(until ? `Schedules paused until ${new Date(until).toLocaleString()}` : 'Schedules resumed')
    res.json(state())
  })

  api.get('/log', (req, res) => {
    res.json(store.events(Math.min(500, Number(req.query.limit) || 100)))
  })

  api.use((req, res) => res.status(404).json({ error: 'not found' }))
  // eslint-disable-next-line no-unused-vars
  api.use((err, req, res, next) => {
    if (!err.status) console.error(err)
    res.status(err.status || 500).json({ error: err.message })
  })

  app.use('/api', api)
  app.use(express.static(config.webroot))

  // --- Lifecycle ---
  let tickTimer, measureTimer

  let tickError = null
  async function tick() {
    try {
      await scheduler.tick()
      await zones.tick()
      if (tickError) log('Relay control restored')
      tickError = null
    } catch (err) {
      if (err.message !== tickError) log(`Relay control failed: ${err.message}`)
      tickError = err.message
    }
  }

  // Measure tanks at the top of every hour
  function scheduleMeasurement() {
    const delay = HOUR_MS - (now() % HOUR_MS)
    measureTimer = setTimeout(async () => {
      await tanks.measure().catch((err) => console.error('Measurement failed', err))
      scheduleMeasurement()
    }, delay)
  }

  async function start(port = config.port) {
    log('Server started')
    await zones.init().catch((err) => {
      log(`Relay control failed: ${err.message}`)
      tickError = err.message
    })
    await tick()
    tickTimer = setInterval(tick, config.tickSeconds * 1000)
    scheduleMeasurement()
    await new Promise((resolve) => server.listen(port, resolve))
    return server.address().port
  }

  async function stop() {
    clearInterval(tickTimer)
    clearTimeout(measureTimer)
    await zones.stopAll('server stopping')
    io.close()
    await new Promise((resolve) => server.close(resolve))
  }

  return { app, server, zones, scheduler, tanks, tick, start, stop }
}
