import { useEffect, useMemo, useRef, useState } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

// Colors come from CSS custom properties so the chart follows light/dark mode
function readTheme(el) {
  const css = getComputedStyle(el)
  const v = (name) => css.getPropertyValue(name).trim()
  return {
    series: [v('--series-1'), v('--series-2')],
    grid: v('--grid'),
    text: v('--text-2'),
    surface: v('--surface'),
    font: `12px ${css.fontFamily}`,
  }
}

function useColorScheme() {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return dark
}

// Align each tank's [ts, percent] points on one shared x axis (uPlot wants seconds)
function toColumns(history) {
  const xs = [...new Set(history.tanks.flatMap((t) => t.points.map((p) => p[0])))].sort((a, b) => a - b)
  const index = new Map(xs.map((x, i) => [x, i]))
  const ys = history.tanks.map((t) => {
    const col = new Array(xs.length).fill(null)
    for (const [ts, pct] of t.points) col[index.get(ts)] = pct
    return col
  })
  return [xs.map((x) => x / 1000), ...ys]
}

const pad = (n) => String(n).padStart(2, '0')

// D/M/YYYY, optionally with the weekday and 24-hour time: "Sun 21/9/2026 16:00"
function formatDate(sec, withTime) {
  const d = new Date(sec * 1000)
  const date = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
  if (!withTime) return date
  const weekday = d.toLocaleDateString([], { weekday: 'short' })
  return `${weekday} ${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// x-axis tick labels, as D/M (uPlot's defaults are US M/D). Each row is:
// [tick spacing (s), label, then the second line to add on a new year/month/day/..., mode]
const DAY = 86_400
const X_AXIS_DATES = [
  [DAY * 365, '{YYYY}', null, null, null, null, null, null, 1],
  [DAY * 28, '{MMM}', '\n{YYYY}', null, null, null, null, null, 1],
  [DAY, '{D}/{M}', '\n{YYYY}', null, null, null, null, null, 1],
  [3600, '{HH}:{mm}', '\n{D}/{M}/{YY}', null, '\n{D}/{M}', null, null, null, 1],
  [60, '{HH}:{mm}', '\n{D}/{M}/{YY}', null, '\n{D}/{M}', null, null, null, 1],
]

// Crosshair readout listing every tank at the hovered time
function tooltipPlugin(names, theme) {
  let tip
  return {
    hooks: {
      init: (u) => {
        tip = document.createElement('div')
        tip.className = 'chart-tooltip'
        tip.hidden = true
        u.over.appendChild(tip)
        u.over.addEventListener('mouseleave', () => { tip.hidden = true })
      },
      setCursor: (u) => {
        const { idx, left } = u.cursor
        if (idx == null || left < 0) {
          tip.hidden = true
          return
        }
        tip.replaceChildren()
        const time = document.createElement('div')
        time.className = 'chart-tooltip-time'
        time.textContent = formatDate(u.data[0][idx], true)
        tip.appendChild(time)
        names.forEach((name, i) => {
          if (!u.series[i + 1].show) return
          const value = u.data[i + 1][idx]
          const row = document.createElement('div')
          row.className = 'chart-tooltip-row'
          const key = document.createElement('i')
          key.style.background = theme.series[i]
          const strong = document.createElement('strong')
          strong.textContent = value == null ? '–' : `${value.toFixed(1)}%`
          const label = document.createElement('span')
          label.textContent = name
          row.append(key, strong, label)
          tip.appendChild(row)
        })
        tip.hidden = false
        const flip = left > u.over.clientWidth / 2
        tip.style.left = flip ? '' : `${left + 12}px`
        tip.style.right = flip ? `${u.over.clientWidth - left + 12}px` : ''
      },
    },
  }
}

// Name each line at its last point
function endLabelPlugin(names, theme) {
  return {
    hooks: {
      draw: (u) => {
        const { ctx } = u
        ctx.save()
        ctx.font = theme.font.replace(/^\d+px/, `${Math.round(12 * devicePixelRatio)}px`)
        ctx.fillStyle = theme.text
        ctx.textBaseline = 'middle'
        const placed = []
        names.forEach((name, i) => {
          if (!u.series[i + 1].show) return
          const ys = u.data[i + 1]
          let j = ys.length - 1
          while (j >= 0 && ys[j] == null) j--
          if (j < 0) return
          const x = u.valToPos(u.data[0][j], 'x', true) + 6 * devicePixelRatio
          let y = u.valToPos(ys[j], 'y', true)
          // Nudge apart if the two labels would overlap
          for (const other of placed) {
            if (Math.abs(other - y) < 14 * devicePixelRatio) y = other + (y >= other ? 1 : -1) * 14 * devicePixelRatio
          }
          placed.push(y)
          // Backing so gridlines don't strike through the label
          const w = ctx.measureText(name).width
          const h = 14 * devicePixelRatio
          ctx.fillStyle = theme.surface
          ctx.fillRect(x - 2 * devicePixelRatio, y - h / 2, w + 4 * devicePixelRatio, h)
          ctx.fillStyle = theme.text
          ctx.fillText(name, x, y)
        })
        ctx.restore()
      },
    },
  }
}

function loadHidden() {
  try {
    return JSON.parse(localStorage.getItem('chart-hidden')) ?? []
  } catch {
    return []
  }
}

export default function TankChart({ history }) {
  const wrap = useRef(null)
  const plotRef = useRef(null)
  // Names of tanks whose line is hidden (toggled from the legend)
  const [hidden, setHidden] = useState(loadHidden)
  const hiddenRef = useRef(hidden)
  const toggle = (name) => {
    const next = hidden.includes(name) ? hidden.filter((n) => n !== name) : [...hidden, name]
    setHidden(next)
    try { localStorage.setItem('chart-hidden', JSON.stringify(next)) } catch { /* not important */ }
  }
  const dark = useColorScheme()
  const data = useMemo(() => toColumns(history), [history])
  const names = useMemo(() => history.tanks.map((t) => t.name), [history])
  const xs = data[0]
  const spanDays = xs.length ? (xs[xs.length - 1] - xs[0]) / 86_400 : 0

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const theme = readTheme(el)
    const axis = {
      stroke: theme.text,
      font: theme.font,
      grid: { stroke: theme.grid, width: 1 },
      ticks: { show: false },
    }
    const opts = {
      width: el.clientWidth,
      height: 220,
      padding: [12, 56, 0, 0],
      legend: { show: false },
      cursor: { drag: { x: false, y: false }, points: { size: 8, width: 2, stroke: theme.surface } },
      scales: { y: { range: [0, 100] } },
      axes: [
        { ...axis, space: 70, values: X_AXIS_DATES },
        { ...axis, size: 44, values: (u, vals) => vals.map((v) => `${v}%`), incrs: [25] },
      ],
      series: [
        {},
        ...names.map((label, i) => ({
          label,
          show: !hiddenRef.current.includes(label),
          stroke: theme.series[i],
          width: 2,
          spanGaps: true,
          points: { show: false },
        })),
      ],
      plugins: [tooltipPlugin(names, theme), endLabelPlugin(names, theme)],
    }
    const plot = new uPlot(opts, data, el)
    plotRef.current = plot
    const ro = new ResizeObserver(() => plot.setSize({ width: el.clientWidth, height: 220 }))
    ro.observe(el)
    return () => {
      ro.disconnect()
      plot.destroy()
      plotRef.current = null
    }
  }, [data, names, dark])

  // Show/hide lines without rebuilding the chart
  useEffect(() => {
    hiddenRef.current = hidden
    names.forEach((name, i) => plotRef.current?.setSeries(i + 1, { show: !hidden.includes(name) }))
  }, [hidden, names])

  const empty = data[0].length === 0

  return (
    <div className="chart">
      <div className="chart-legend">
        {names.map((name, i) => (
          <button key={name} type="button" aria-pressed={!hidden.includes(name)} onClick={() => toggle(name)}
            title={`${hidden.includes(name) ? 'Show' : 'Hide'} ${name}`}>
            <i className={`line-key series-${i + 1}`} />{name}
          </button>
        ))}
      </div>
      {empty ? <p className="muted chart-empty">No readings in this period.</p> : <div ref={wrap} className="chart-plot" />}
      {!empty && (
        <details className="chart-table">
          <summary>Show as table</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th scope="col">Time</th>{names.map((n) => <th scope="col" key={n}>{n}</th>)}</tr>
              </thead>
              <tbody>
                {data[0].map((x, j) => j).reverse().map((j) => (
                  <tr key={data[0][j]}>
                    <td>{formatDate(data[0][j], spanDays < 60)}</td>
                    {names.map((n, i) => <td key={n}>{data[i + 1][j] == null ? '–' : `${data[i + 1][j].toFixed(1)}%`}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
