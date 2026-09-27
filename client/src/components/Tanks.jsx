import { useEffect, useState } from 'react'
import tankIcon from '../assets/icon-tank.png'
import { api } from '../api.js'
import { formatAgo } from '../format.js'
import TankChart from './TankChart.jsx'

const PERIODS = [
  { label: 'Day', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: 'Week', hours: 168 },
  { label: 'Month', hours: 720 },
  { label: 'Quarter', hours: 2160 },
  { label: 'Year', hours: 8760 },
  { label: 'All', hours: 0 },
]

function loadPeriod() {
  try {
    const hours = Number(localStorage.getItem('tank-period'))
    return PERIODS.some((p) => p.hours === hours) && localStorage.getItem('tank-period') !== null ? hours : 168
  } catch {
    return 168
  }
}

export default function Tanks({ tanks, now, act }) {
  const [hours, setHoursState] = useState(loadPeriod)
  const [history, setHistory] = useState(null)
  const [measuring, setMeasuring] = useState(false)
  const latestTs = Math.max(0, ...tanks.map((t) => t.ts ?? 0))

  const setHours = (h) => {
    setHoursState(h)
    try { localStorage.setItem('tank-period', h) } catch { /* not important */ }
  }

  // Reload history when the period changes or a new reading arrives
  useEffect(() => {
    let cancelled = false
    api('GET', `/tanks/history?hours=${hours}`)
      .then((h) => { if (!cancelled) setHistory(h) })
      .catch(() => { if (!cancelled) setHistory(null) })
    return () => { cancelled = true }
  }, [hours, latestTs])

  const measure = async () => {
    setMeasuring(true)
    try {
      await act('POST', '/tanks/measure')
    } catch { /* shown by App */ } finally {
      setMeasuring(false)
    }
  }

  return (
    <section className="card tanks" aria-labelledby="tanks-heading">
      <div className="zone-head">
        <img src={tankIcon} alt="" className="zone-icon" />
        <div>
          <h2 id="tanks-heading">Tanks</h2>
          <p className="zone-status">{latestTs ? `Measured ${formatAgo(latestTs, now)}` : 'No readings yet'}</p>
        </div>
        <button className="button ghost small" onClick={measure} disabled={measuring}>
          {measuring ? 'Measuring…' : 'Measure now'}
        </button>
      </div>

      <div className="gauges">
        {tanks.map((tank, i) => (
          <div className="gauge" key={tank.id}>
            <div className="gauge-tank" role="meter" aria-label={tank.name} aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={tank.percent ?? undefined}>
              <div className={`gauge-fill series-${i + 1}`} style={{ height: `${tank.percent ?? 0}%` }} />
            </div>
            <div className="gauge-text">
              <span className="gauge-value">{tank.percent == null ? '–' : `${Math.round(tank.percent)}%`}</span>
              <span className="gauge-name"><i className={`key series-${i + 1}`} />{tank.name}</span>
              {tank.ts && latestTs - tank.ts > 2 * 3_600_000 && (
                <span className="gauge-stale">Last reading {formatAgo(tank.ts, now)}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="history">
        <div className="history-head">
          <label htmlFor="history-period">History</label>
          <select id="history-period" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {PERIODS.map((p) => <option key={p.hours} value={p.hours}>{p.label}</option>)}
          </select>
        </div>
        {history && <TankChart history={history} />}
      </div>
    </section>
  )
}
