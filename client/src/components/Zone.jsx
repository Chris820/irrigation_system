import { useState } from 'react'
import gardenIcon from '../assets/icon-garden.png'
import lawnIcon from '../assets/icon-lawn.png'
import { formatCountdown, formatMinutes, formatTime, formatWhen } from '../format.js'
import Schedules from './Schedules.jsx'

const ICONS = { garden: gardenIcon, lawn: lawnIcon }
const PRESETS = [15, 30, 60]

function loadMinutes(zoneId) {
  try {
    return Number(localStorage.getItem(`run-minutes:${zoneId}`)) || 15
  } catch {
    return 15
  }
}

export default function Zone({ zone, schedules, paused, maxRunMinutes, now, act }) {
  const [minutes, setMinutesState] = useState(() => loadMinutes(zone.id))
  const [busy, setBusy] = useState(false)
  const setMinutes = (m) => {
    setMinutesState(m)
    try { localStorage.setItem(`run-minutes:${zone.id}`, m) } catch { /* not important */ }
  }

  const call = async (method, url, body) => {
    setBusy(true)
    try {
      await act(method, url, body)
    } catch { /* shown by App */ } finally {
      setBusy(false)
    }
  }

  const { run } = zone
  const sliderMax = Math.min(maxRunMinutes, 90)
  let status
  if (run) {
    status = `Running (${run.source === 'schedule' ? 'scheduled' : 'manual'}) until ${formatTime(run.until)}`
  } else if (zone.next) {
    status = paused ? `Off · schedules paused` : `Off · next run ${formatWhen(zone.next.start, now)}`
  } else {
    status = 'Off · nothing scheduled'
  }

  return (
    <section className={`card zone${run ? ' running' : ''}`} aria-labelledby={`zone-${zone.id}`}>
      <div className="zone-head">
        {ICONS[zone.icon] && <img src={ICONS[zone.icon]} alt="" className="zone-icon" />}
        <div>
          <h2 id={`zone-${zone.id}`}>{zone.name}</h2>
          <p className="zone-status">{status}</p>
        </div>
        <span className={`pill ${run ? 'on' : 'off'}`}>{run ? 'On' : 'Off'}</span>
      </div>

      {run ? (
        <div className="run-active">
          <div className="countdown" aria-live="polite">
            {formatCountdown(run.until - now)}
            <span> left</span>
          </div>
          <div className="progress" role="progressbar" aria-label={`${zone.name} run progress`}
            aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(1, (now - run.startedAt) / (run.until - run.startedAt)) * 100)}>
            <div style={{ width: `${Math.min(100, ((now - run.startedAt) / (run.until - run.startedAt)) * 100)}%` }} />
          </div>
          <div className="button-row">
            <button className="button" disabled={busy}
              onClick={() => call('POST', `/zones/${zone.id}/run`, { minutes: Math.min(maxRunMinutes, Math.ceil((run.until - now) / 60_000) + 5) })}>
              +5 min
            </button>
            <button className="button danger" disabled={busy} onClick={() => call('POST', `/zones/${zone.id}/stop`)}>
              Stop
            </button>
          </div>
        </div>
      ) : (
        <div className="run-setup">
          <label className="run-label" htmlFor={`minutes-${zone.id}`}>
            Water for <strong>{formatMinutes(minutes)}</strong>
          </label>
          <input id={`minutes-${zone.id}`} type="range" min={1} max={sliderMax} value={Math.min(minutes, sliderMax)}
            onChange={(e) => setMinutes(Number(e.target.value))} />
          <div className="presets" role="group" aria-label="Quick durations">
            {PRESETS.filter((p) => p <= sliderMax).map((p) => (
              <button key={p} className="chip" aria-pressed={minutes === p} onClick={() => setMinutes(p)}>{p}m</button>
            ))}
          </div>
          <button className="button primary wide" disabled={busy}
            onClick={() => call('POST', `/zones/${zone.id}/run`, { minutes })}>
            Start {zone.name.toLowerCase()}
          </button>
        </div>
      )}

      <Schedules zone={zone} schedules={schedules} maxRunMinutes={maxRunMinutes} act={act} />
    </section>
  )
}
