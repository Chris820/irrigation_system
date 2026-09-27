import { useCallback, useState } from 'react'
import { api, useLiveState, useNow } from './api.js'
import ActivityLog from './components/ActivityLog.jsx'
import PauseControl from './components/PauseControl.jsx'
import Tanks from './components/Tanks.jsx'
import Zone from './components/Zone.jsx'
import { formatDateTime } from './format.js'

export default function App() {
  const { state, connected, offset } = useLiveState()
  const now = useNow(offset)
  const [error, setError] = useState(null)

  // Run an API call, surfacing any failure in the error banner
  const act = useCallback(async (method, url, body) => {
    setError(null)
    try {
      return await api(method, url, body)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  if (!state) {
    return <main className="loading">{connected ? 'Loading…' : 'Connecting to the irrigation system…'}</main>
  }

  const anyRunning = state.zones.some((z) => z.run)

  return (
    <main>
      <header className="app-header">
        <span className={`connection ${connected ? 'online' : 'offline'}`} role="status">
          {connected ? 'Live' : 'Reconnecting…'}
        </span>
        {anyRunning && (
          <button className="button danger" onClick={() => act('POST', '/stop-all').catch(() => {})}>
            Stop all
          </button>
        )}
      </header>

      {error && (
        <div className="banner error" role="alert">
          <span>{error}</span>
          <button className="button ghost" onClick={() => setError(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      {state.pausedUntil && (
        <div className="banner paused">
          <span>Schedules paused until {formatDateTime(state.pausedUntil)}</span>
          <button className="button ghost" onClick={() => act('PUT', '/pause', { until: null }).catch(() => {})}>Resume</button>
        </div>
      )}

      <Tanks tanks={state.tanks} now={now} act={act} />

      {state.zones.map((zone) => (
        <Zone
          key={zone.id}
          zone={zone}
          schedules={state.schedules.filter((s) => s.zoneId === zone.id)}
          paused={!!state.pausedUntil}
          maxRunMinutes={state.maxRunMinutes}
          now={now}
          act={act}
        />
      ))}

      <section className="card">
        <PauseControl pausedUntil={state.pausedUntil} now={now} act={act} />
        <ActivityLog entries={state.log} now={now} />
      </section>
    </main>
  )
}
