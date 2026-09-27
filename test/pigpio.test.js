import assert from 'node:assert/strict'
import net from 'node:net'
import { after, before, test } from 'node:test'
import { CMD, PigpioClient } from '../server/pigpio.js'
import { measureDistance, MM_PER_US, summarise } from '../server/ultrasonic.js'

// A fake pigpiod speaking the socket protocol. A trigger pulse produces an echo
// on every notification socket, as if the water were `distanceMm` away.
function fakePigpiod() {
  const state = { pins: new Map(), distanceMm: 1000, silent: false, echo: true, tick: 0xffffff00 }
  const notifySockets = new Set()
  const server = net.createServer((socket) => {
    let buf = Buffer.alloc(0)
    socket.on('error', () => {})
    socket.on('close', () => notifySockets.delete(socket))
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk])
      while (buf.length >= 16) {
        const [cmd, p1, p2, p3] = [0, 4, 8, 12].map((o) => buf.readUInt32LE(o))
        if (buf.length < 16 + p3) return
        const ext = buf.subarray(16, 16 + p3)
        buf = buf.subarray(16 + p3)
        if (state.silent) continue
        let res = 0
        if (cmd === CMD.WRITE) state.pins.set(p1, p2)
        else if (cmd === CMD.READ) res = state.pins.get(p1) ?? 0
        else if (cmd === CMD.NOIB) notifySockets.add(socket)
        else if (cmd === CMD.TRIG && state.echo) setTimeout(() => echo(ext.readUInt32LE(0)), 2)
        else if (cmd === 1234) res = -41
        const reply = Buffer.alloc(16)
        ;[cmd, p1, p2].forEach((v, i) => reply.writeUInt32LE(v, i * 4))
        reply.writeInt32LE(res, 12)
        socket.write(reply)
      }
    })
  })
  const report = (seq, flags, tick, levels) => {
    const r = Buffer.alloc(12)
    r.writeUInt16LE(seq, 0)
    r.writeUInt16LE(flags, 2)
    r.writeUInt32LE(tick >>> 0, 4)
    r.writeUInt32LE(levels >>> 0, 8)
    return r
  }
  function echo() {
    const width = Math.round(state.distanceMm / MM_PER_US)
    const rise = (state.tick += 500) >>> 0
    const fall = (state.tick += width) >>> 0
    // A keep-alive in between, and the tick wraps past 2^32 during the test
    const data = Buffer.concat([report(1, 0, rise, 1 << 24), report(2, 0x40, rise, 1 << 24), report(3, 0, fall, 0)])
    for (const s of notifySockets) {
      // Split mid-report to exercise buffering
      s.write(data.subarray(0, 17))
      s.write(data.subarray(17))
    }
  }
  return { server, state }
}

let fake, port
before(async () => {
  fake = fakePigpiod()
  await new Promise((resolve) => fake.server.listen(0, resolve))
  port = fake.server.address().port
})
after(() => fake.server.close())

test('summarise keeps readings clustered around the mode', () => {
  assert.equal(summarise([]), null)
  assert.equal(summarise([1000, 1002, 998, 1500, 400]), 1000)
  assert.equal(summarise([1234.4]), 1234.4)
})

test('writes and reads pins', async () => {
  const pi = new PigpioClient({ port })
  await pi.write(27, 1)
  assert.equal(fake.state.pins.get(27), 1)
  assert.equal(await pi.read(27), 1)
  await pi.close()
})

test('pigpio errors reject with the code', async () => {
  const pi = new PigpioClient({ port })
  await assert.rejects(pi.request(1234, 0, 0), /pigpio error -41/)
  // The connection is still usable afterwards
  await pi.write(4, 0)
  await pi.close()
})

test('measures distance from echo timing, across a tick wrap', async () => {
  const pi = new PigpioClient({ port })
  fake.state.distanceMm = 1234
  const mm = await measureDistance(pi, { trigger: 23, echo: 24, samples: 4, gapMs: 1 })
  assert.ok(Math.abs(mm - 1234) < 1, `got ${mm}`)
  assert.ok(fake.state.tick > 2 ** 32, 'tick wrapped')
  await pi.close()
})

test('no echo is an error, not a hang', async () => {
  const pi = new PigpioClient({ port })
  fake.state.echo = false
  await assert.rejects(measureDistance(pi, { trigger: 23, echo: 24, samples: 2, gapMs: 1, echoTimeoutMs: 20 }), /no echo/)
  fake.state.echo = true
  await pi.close()
})

test('an unresponsive daemon times out and the client recovers', async () => {
  const pi = new PigpioClient({ port, timeoutMs: 100 })
  fake.state.silent = true
  await assert.rejects(pi.write(4, 1), /lost connection to pigpiod/)
  fake.state.silent = false
  await pi.write(4, 1)
  await pi.close()
})

test('an unreachable host fails fast with a clear message', async () => {
  const pi = new PigpioClient({ port: 1, timeoutMs: 500 })
  await assert.rejects(pi.write(4, 1), /can't reach pigpiod on localhost:1/)
})
