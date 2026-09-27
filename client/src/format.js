export const DAYS = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 0, short: 'Sun' },
]

export function formatDays(days) {
  if (days.length === 7) return 'Every day'
  const set = new Set(days)
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Weekdays'
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends'
  return DAYS.filter((d) => set.has(d.value)).map((d) => d.short).join(' ')
}

export function formatCountdown(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export function formatMinutes(min) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// "Thu 2 Oct, 16:40"
export function formatDateTime(ts) {
  return new Date(ts).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// "today 06:30", "tomorrow 06:30", "Thu 06:30"
export function formatWhen(ts, now) {
  const d = new Date(ts)
  const today = new Date(now)
  const dayDiff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000,
  )
  if (dayDiff === 0) return `today ${formatTime(ts)}`
  if (dayDiff === 1) return `tomorrow ${formatTime(ts)}`
  return `${d.toLocaleDateString([], { weekday: 'short' })} ${formatTime(ts)}`
}

export function formatAgo(ts, now) {
  const min = Math.round((now - ts) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} h ago`
  return new Date(ts).toLocaleDateString()
}
