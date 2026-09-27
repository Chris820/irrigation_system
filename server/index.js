import { createApp } from './app.js'
import config from './config.js'
import { openDb } from './db.js'
import { createHosts } from './gpio.js'

const store = openDb(config.dbPath)
const hosts = createHosts(config.gpioHosts, { mock: config.mock })
const irrigation = await createApp({ config, store, hosts })

const port = await irrigation.start()
console.log(`Listening on :${port} (GPIO driver: ${config.gpioDriver})`)

// Always close every solenoid on the way out
let stopping = false
async function shutdown(code) {
  if (stopping) return
  stopping = true
  try {
    await irrigation.stop()
    await Promise.all(Object.values(hosts).map((h) => h.close()))
  } finally {
    process.exit(code)
  }
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception', err)
  shutdown(1)
})
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection', err)
  shutdown(1)
})
