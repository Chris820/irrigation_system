import { formatAgo } from '../format.js'

export default function ActivityLog({ entries, now }) {
  return (
    <details className="setting activity">
      <summary>
        <h3>Activity</h3>
        {entries[0] && <span className="muted">{entries[0].message}</span>}
      </summary>
      <ol>
        {entries.map((e, i) => (
          <li key={`${e.ts}-${i}`}>
            <time dateTime={new Date(e.ts).toISOString()} title={new Date(e.ts).toLocaleString()}>{formatAgo(e.ts, now)}</time>
            <span>{e.message}</span>
          </li>
        ))}
      </ol>
    </details>
  )
}
