import net from 'node:net'

// Minimal client for the pigpio daemon's socket interface, for a local or remote Pi.
// https://abyz.me.uk/rpi/pigpio/sif.html
//
// Commands are 16 bytes (cmd, p1, p2, p3 as uint32 LE, then p3 bytes of extension)
// and each gets a 16-byte reply in order, whose last field is the result (< 0 = error).
// A second socket, switched to notification mode with NOIB, streams 12-byte reports
// (seqno u16, flags u16, tick u32 microseconds, levels u32) whenever a watched GPIO changes.

export const CMD = { MODES: 0, PUD: 2, READ: 3, WRITE: 4, NB: 19, NC: 21, TRIG: 37, NOIB: 99 }
const MODE = { input: 0, output: 1 }
const PULL = { off: 0, down: 1, up: 2 }
// Report flags for keep-alive, watchdog and event reports (not level changes)
const NOT_A_CHANGE = 0x40 | 0x20 | 0x80

function command(cmd, p1 = 0, p2 = 0, ext = null) {
  const msg = Buffer.alloc(16 + (ext?.length ?? 0))
  msg.writeUInt32LE(cmd, 0)
  msg.writeUInt32LE(p1, 4)
  msg.writeUInt32LE(p2, 8)
  msg.writeUInt32LE(ext?.length ?? 0, 12)
  ext?.copy(msg, 16)
  return msg
}

function openSocket(host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port })
    const timer = setTimeout(() => socket.destroy(new Error('timed out')), timeoutMs)
    socket.once('connect', () => {
      clearTimeout(timer)
      socket.setNoDelay(true)
      resolve(socket)
    })
    socket.once('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`can't reach pigpiod on ${host}:${port} (${err.code || err.message})`))
    })
  })
}

export class PigpioClient {
  constructor({ host = 'localhost', port = 8888, timeoutMs = 3000 } = {}) {
    this.host = host
    this.port = port
    this.timeoutMs = timeoutMs
    this.connecting = null
    this.pending = []
    this.buf = Buffer.alloc(0)
  }

  // Connects on first use, and again after the connection drops
  #connect() {
    this.connecting ??= openSocket(this.host, this.port, this.timeoutMs).then(
      (socket) => {
        let lastError
        socket.on('data', (chunk) => this.#onData(chunk))
        socket.on('error', (err) => { lastError = err })
        socket.on('close', () => {
          this.connecting = null
          this.buf = Buffer.alloc(0)
          const err = new Error(`lost connection to pigpiod on ${this.host} (${lastError?.message ?? 'closed'})`)
          for (const p of this.pending.splice(0)) {
            clearTimeout(p.timer)
            p.reject(err)
          }
        })
        return socket
      },
      (err) => {
        this.connecting = null
        throw err
      },
    )
    return this.connecting
  }

  #onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk])
    while (this.buf.length >= 16) {
      const res = this.buf.readInt32LE(12)
      this.buf = this.buf.subarray(16)
      const p = this.pending.shift()
      if (!p) continue
      clearTimeout(p.timer)
      if (res < 0) p.reject(new Error(`pigpio error ${res} on ${this.host}`))
      else p.resolve(res)
    }
  }

  async request(cmd, p1, p2, ext) {
    const socket = await this.#connect()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => socket.destroy(new Error('no reply')), this.timeoutMs)
      this.pending.push({ resolve, reject, timer })
      socket.write(command(cmd, p1, p2, ext))
    })
  }

  setMode(gpio, mode) {
    return this.request(CMD.MODES, gpio, MODE[mode])
  }
  setPull(gpio, pull) {
    return this.request(CMD.PUD, gpio, PULL[pull])
  }
  // Also switches the pin to output, setting the level first so it never glitches
  write(gpio, level) {
    return this.request(CMD.WRITE, gpio, level ? 1 : 0)
  }
  read(gpio) {
    return this.request(CMD.READ, gpio)
  }
  // A pulse of `us` microseconds (max 100) at `level`, timed by the daemon
  trigger(gpio, us, level) {
    const ext = Buffer.alloc(4)
    ext.writeUInt32LE(level ? 1 : 0)
    return this.request(CMD.TRIG, gpio, us, ext)
  }

  // Calls onChange({ tick, levels }) whenever any GPIO in `bits` changes level.
  // `tick` is the daemon's microsecond clock (wraps at 2^32). Resolves to a close function.
  async notify(bits, onChange) {
    const socket = await openSocket(this.host, this.port, this.timeoutMs)
    let buf = Buffer.alloc(0)
    let handle = null
    const opened = new Promise((resolve, reject) => {
      const timer = setTimeout(() => socket.destroy(new Error('no reply')), this.timeoutMs)
      socket.on('error', (err) => { clearTimeout(timer); reject(new Error(`pigpiod notifications on ${this.host}: ${err.message}`)) })
      socket.on('close', () => { clearTimeout(timer); reject(new Error(`pigpiod notifications on ${this.host} closed`)) })
      socket.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk])
        if (handle === null) {
          // First reply is to NOIB and carries the notification handle
          if (buf.length < 16) return
          clearTimeout(timer)
          const res = buf.readInt32LE(12)
          buf = buf.subarray(16)
          if (res < 0) return reject(new Error(`pigpio error ${res} opening notifications on ${this.host}`))
          handle = res
          resolve(res)
        }
        let i = 0
        for (; i + 12 <= buf.length; i += 12) {
          const flags = buf.readUInt16LE(i + 2)
          if (flags & NOT_A_CHANGE) continue
          onChange({ tick: buf.readUInt32LE(i + 4), levels: buf.readUInt32LE(i + 8) })
        }
        buf = buf.subarray(i)
      })
    })
    socket.write(command(CMD.NOIB))
    try {
      await opened
      await this.request(CMD.NB, handle, bits >>> 0)
    } catch (err) {
      socket.destroy()
      throw err
    }
    return async () => {
      try {
        await this.request(CMD.NC, handle)
      } finally {
        socket.destroy()
      }
    }
  }

  async close() {
    const socket = await this.connecting?.catch(() => null)
    socket?.end()
  }
}
