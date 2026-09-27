// Distance from an ultrasonic sensor (SEN0208 / HC-SR04 style) via pigpiod.
// The daemon sends the 10us trigger pulse and timestamps the echo edges on the
// Pi the sensor is wired to, so network latency doesn't affect accuracy.

// Speed of sound 343.26 m/s = 0.34326 mm/us, halved for the round trip
export const MM_PER_US = 0.34326 / 2

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Keep only readings that cluster around the most common value (to the nearest cm),
// and average them. Filters out stray echoes.
export function summarise(readingsMm) {
  if (!readingsMm.length) return null
  const counts = new Map()
  for (const mm of readingsMm) {
    const cm = Math.round(mm / 10)
    counts.set(cm, (counts.get(cm) ?? 0) + 1)
  }
  const mode = [...counts].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0]
  const cluster = readingsMm.filter((mm) => Math.round(mm / 10) === mode)
  return Math.round((cluster.reduce((a, b) => a + b, 0) / cluster.length) * 10) / 10
}

export async function measureDistance(host, { trigger, echo, samples = 10, echoTimeoutMs = 300, gapMs = 125 }) {
  await host.write(trigger, 0)
  await host.setMode(echo, 'input')

  const bit = 1 << echo
  let level = null
  let rise = null
  let onEcho = null
  const close = await host.notify(bit, ({ tick, levels }) => {
    const now = levels & bit ? 1 : 0
    if (now === level) return
    level = now
    if (now) rise = tick
    else if (rise !== null) {
      onEcho?.((tick - rise) >>> 0)
      rise = null
    }
  })

  const readings = []
  try {
    for (let i = 0; i < samples; i++) {
      rise = null
      const us = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(null), echoTimeoutMs)
        onEcho = (width) => {
          clearTimeout(timer)
          resolve(width)
        }
        host.trigger(trigger, 10, 1).catch((err) => {
          clearTimeout(timer)
          reject(err)
        })
      })
      onEcho = null
      if (us) readings.push(us * MM_PER_US)
      // Don't thrash the sensor
      await sleep(gapMs)
    }
  } finally {
    await close().catch(() => {})
  }

  const mm = summarise(readings)
  if (mm === null) throw new Error('no echo from sensor')
  return mm
}
