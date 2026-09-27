import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

export async function api(method, url, body) {
  const res = await fetch(`/api${url}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

// Live server state, pushed over socket.io whenever anything changes.
// `offset` corrects for the device clock differing from the Pi's.
export function useLiveState() {
  const [state, setState] = useState(null)
  const [connected, setConnected] = useState(false)
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    const socket = io()
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('state', (s) => {
      setState(s)
      setOffset(s.serverTime - Date.now())
    })
    return () => socket.close()
  }, [])
  return { state, connected, offset }
}

// Current (server-corrected) time, updated every `ms`
export function useNow(offset, ms = 1000) {
  const [now, setNow] = useState(() => Date.now() + offset)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), ms)
    return () => clearInterval(id)
  }, [offset, ms])
  return now
}
