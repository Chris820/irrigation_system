import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { toBcm } from './pins.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(ROOT, 'data')

// Real GPIO (via pigpiod) on the Pi, a mock everywhere else. Force with GPIO_DRIVER=mock|pigpio
const onPi = process.platform === 'linux' && process.arch.startsWith('arm')
const gpioDriver = process.env.GPIO_DRIVER || (onPi ? 'pigpio' : 'mock')

// Pins below are physical pin numbers, as on the 40-pin header diagram.
// They're converted to the BCM numbers pigpio uses at the end of this file.
const config = {
  port: Number(process.env.PORT) || 5000,
  dbPath: process.env.DB_PATH || path.join(dataDir, 'irrigation.db'),
  webroot: path.join(ROOT, 'client', 'dist'),
  gpioDriver,
  mock: gpioDriver === 'mock',

  // Safety net: no zone may run longer than this in one go, however it was started
  maxRunMinutes: 180,
  // How often zones and schedules are re-evaluated
  tickSeconds: 15,
  // How many activity log entries to keep
  logRetention: 2000,

  // Each Pi's pigpiod daemon. The other Pi must allow remote connections (see README).
  gpioHosts: {
    local: { host: 'localhost', port: 8888 },
    tank2: { host: process.env.TANK2_HOST || 'tank2.local', port: 8888 },
  },

  // Sprinkler zones, on this Pi.
  // The relay board is active-low: a low pin opens the solenoid, a high pin closes it.
  zones: [
    { id: 'garden', name: 'Gardens', icon: 'garden', pin: 13, activeLow: true },
    { id: 'lawn', name: 'Lawns', icon: 'lawn', pin: 7, activeLow: true },
  ],

  // Water tanks. full/empty are the sensor-to-surface distances in mm.
  tanks: [
    {
      id: 'tank1',
      name: 'Tank 1',
      full: 270,
      empty: 1800,
      // Ultrasonic sensor on this Pi
      sensor: { host: 'local', trigger: 16, echo: 18 },
    },
    {
      id: 'tank2',
      name: 'Tank 2',
      full: 340,
      empty: 1800,
      // Ultrasonic sensor on the other Pi, read over the network.
      // Pins 3 and 5 are also I2C, so I2C must stay disabled on that Pi.
      sensor: { host: 'tank2', trigger: 3, echo: 5 },
    },
  ],
}

export default {
  ...config,
  zones: config.zones.map((z) => ({ ...z, pin: toBcm(z.pin) })),
  tanks: config.tanks.map((t) => ({ ...t, sensor: { ...t.sensor, trigger: toBcm(t.sensor.trigger), echo: toBcm(t.sensor.echo) } })),
}
