const OPTIONS = [
  { label: '1 day', days: 1 },
  { label: '2 days', days: 2 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
]

// "Rain delay": skip scheduled runs for x days
export default function PauseControl({ pausedUntil, now, act }) {
  const pause = (days) => act('PUT', '/pause', { until: now + days * 86_400_000 }).catch(() => {})
  return (
    <div className="setting">
      <h3>Pause schedules</h3>
      <p className="muted">
        {pausedUntil ? 'Paused' : 'Pause scheduled watering for:'}
      </p>
      <div className="presets">
        {OPTIONS.map((o) => (
          <button key={o.days} className="chip" onClick={() => pause(o.days)}>{o.label}</button>
        ))}
        {pausedUntil && (
          <button className="chip" onClick={() => act('PUT', '/pause', { until: null }).catch(() => {})}>Resume now</button>
        )}
      </div>
    </div>
  )
}
