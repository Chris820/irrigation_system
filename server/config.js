import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(ROOT, 'data')

// Real GPIO (via pigpiod) on the Pi, a mock everywhere else. Force with GPIO_DRIVER=mock|pigpio
const onPi = process.platform === 'linux' && process.arch.startsWith('arm')
const gpioDriver = process.env.GPIO_DRIVER || (onPi ? 'pigpio' : 'mock')

export default {
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

  // Sprinkler zones, on this Pi. Pins are BCM numbers (physical pin in the comment).
  // The relay board is active-low: writing 0 opens the solenoid, 1 closes it.
  zones: [
    { id: 'garden', name: 'Gardens', icon: 'garden', pin: 27 /* pin 13 */, activeLow: true },
    { id: 'lawn', name: 'Lawns', icon: 'lawn', pin: 4 /* pin 7 */, activeLow: true },
  ],

  // Water tanks. full/empty are the sensor-to-surface distances in mm.
  tanks: [
    {
      id: 'tank1',
      name: 'Tank 1',
      full: 270,
      empty: 1800,
      // Ultrasonic sensor on this Pi. BCM pins: trigger 23 (pin 16), echo 24 (pin 18)
      sensor: { host: 'local', trigger: 23, echo: 24 },
    },
    {
      id: 'tank2',
      name: 'Tank 2',
      full: 340,
      empty: 1800,
      // Ultrasonic sensor on the other Pi, read over the network.
      // BCM pins: trigger 3 (pin 5), echo 5 (pin 29).
      // BCM 3 is also I2C SDA, so I2C must stay disabled on that Pi (or move the trigger).
      sensor: { host: 'tank2', trigger: 3, echo: 5 },
    },
  ],
}
