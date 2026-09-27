// GPIO hosts: one per Pi, reached through its pigpiod daemon (local or over the
// network). Pins are BCM numbers. A mock host stands in for development and tests.
import { PigpioClient } from './pigpio.js'
import { MM_PER_US } from './ultrasonic.js'

export function createHosts(hostsConfig, { mock }) {
  return Object.fromEntries(Object.entries(hostsConfig).map(([name, cfg]) => [
    name,
    mock ? mockHost() : new PigpioClient(cfg),
  ]))
}

// Keeps pin levels in memory. A trigger pulse produces an echo on every watched pin,
// as if the water were `distanceMm()` away.
export function mockHost({ distanceMm = () => 500 + Math.random() * 900 } = {}) {
  const pins = new Map()
  const watchers = new Set()
  let tick = 0
  const emit = (on) => {
    for (const w of watchers) w.onChange({ tick, levels: on ? w.bits : 0 })
  }
  return {
    pins,
    watchers,
    setMode: async () => {},
    write: async (pin, level) => { pins.set(pin, level ? 1 : 0) },
    trigger: async () => {
      const width = Math.round(distanceMm() / MM_PER_US)
      setTimeout(() => {
        tick = (tick + 500) >>> 0
        emit(true)
        tick = (tick + width) >>> 0
        emit(false)
      }, 1)
    },
    notify: async (bits, onChange) => {
      const w = { bits, onChange }
      watchers.add(w)
      return async () => { watchers.delete(w) }
    },
    close: async () => {},
  }
}
