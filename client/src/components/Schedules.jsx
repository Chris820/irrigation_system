import { useState } from 'react'
import { DAYS, formatDays, formatMinutes } from '../format.js'

export default function Schedules({ zone, schedules, maxRunMinutes, act }) {
  // null, 'new', or the id of the schedule being edited
  const [editing, setEditing] = useState(null)

  const save = async (values) => {
    if (editing === 'new') await act('POST', '/schedules', { zoneId: zone.id, ...values })
    else await act('PUT', `/schedules/${editing}`, values)
    setEditing(null)
  }
  const toggle = (s) => act('PUT', `/schedules/${s.id}`, { ...s, enabled: !s.enabled }).catch(() => {})
  const remove = (s) => {
    if (window.confirm(`Delete this ${zone.name.toLowerCase()} schedule?`)) act('DELETE', `/schedules/${s.id}`).catch(() => {})
  }

  return (
    <div className="schedules">
      <h3>Schedules</h3>
      {schedules.length === 0 && editing !== 'new' && <p className="muted">No schedules yet.</p>}
      <ul>
        {schedules.map((s) =>
          editing === s.id ? (
            <li key={s.id}>
              <ScheduleEditor initial={s} maxRunMinutes={maxRunMinutes} onSave={save} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <li key={s.id} className={`schedule-row${s.enabled ? '' : ' disabled'}`}>
              <div className="schedule-summary">
                <strong>{s.start}</strong> for {formatMinutes(s.durationMin)}
                <span className="muted">{formatDays(s.days)}</span>
              </div>
              <label className="switch" title={s.enabled ? 'Enabled' : 'Disabled'}>
                <input type="checkbox" checked={s.enabled} onChange={() => toggle(s)}
                  aria-label={`${s.enabled ? 'Disable' : 'Enable'} ${s.start} schedule`} />
                <span />
              </label>
              <button className="button ghost small" onClick={() => setEditing(s.id)}>Edit</button>
              <button className="button ghost small" onClick={() => remove(s)} aria-label={`Delete ${s.start} schedule`}>Delete</button>
            </li>
          ),
        )}
        {editing === 'new' && (
          <li>
            <ScheduleEditor maxRunMinutes={maxRunMinutes} onSave={save} onCancel={() => setEditing(null)} />
          </li>
        )}
      </ul>
      {editing === null && (
        <button className="button ghost" onClick={() => setEditing('new')}>+ Add schedule</button>
      )}
    </div>
  )
}

function ScheduleEditor({ initial, maxRunMinutes, onSave, onCancel }) {
  const [days, setDays] = useState(initial?.days ?? [1, 3, 5])
  const [start, setStart] = useState(initial?.start ?? '06:00')
  const [duration, setDuration] = useState(String(initial?.durationMin ?? 15))
  const [saving, setSaving] = useState(false)

  const durationMin = Number(duration)
  const valid = days.length > 0 && /^\d\d:\d\d$/.test(start) && Number.isInteger(durationMin) && durationMin >= 1 && durationMin <= maxRunMinutes

  const toggleDay = (d) => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])
  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ days, start, durationMin, enabled: initial?.enabled ?? true })
    } catch { /* shown by App */ } finally {
      setSaving(false)
    }
  }

  return (
    <form className="schedule-editor" onSubmit={submit}>
      <div className="day-picker" role="group" aria-label="Days">
        {DAYS.map((d) => (
          <button type="button" key={d.value} className="chip" aria-pressed={days.includes(d.value)} onClick={() => toggleDay(d.value)}>
            {d.short}
          </button>
        ))}
      </div>
      <div className="fields">
        <label>
          Start
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label>
          Minutes
          <input type="number" inputMode="numeric" min={1} max={maxRunMinutes} value={duration}
            onChange={(e) => setDuration(e.target.value)} required />
        </label>
      </div>
      <div className="button-row">
        <button type="button" className="button ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="button primary" disabled={!valid || saving}>Save</button>
      </div>
    </form>
  )
}
