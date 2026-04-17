import { useMemo, useState } from 'react'
import {
  diffDays,
  formatMonthLabel,
  parseISOToLocal,
  toISODateLocal,
  todayISO,
} from '../dates'
import type { CyclePrediction } from '../cycleMath'
import { periodRangesFromDays } from '../cycleMath'

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function buildMonthGrid(year: number, monthIndex0: number): (string | null)[] {
  const first = new Date(year, monthIndex0, 1)
  const startWeekday = first.getDay() // 0 Sun
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate()
  const pad = (startWeekday + 6) % 7 // Monday-first: Mon=0
  const cells: (string | null)[] = []
  for (let i = 0; i < pad; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    const dt = new Date(year, monthIndex0, day)
    cells.push(toISODateLocal(dt))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function CalendarView({
  periodDays,
  prediction,
  onToggleDay,
}: {
  periodDays: string[]
  prediction: CyclePrediction
  onToggleDay: (iso: string) => void
}) {
  const [cursor, setCursor] = useState(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), 1)
  })

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month])
  const today = todayISO()

  const periodSet = useMemo(() => new Set(periodDays), [periodDays])
  const ranges = useMemo(() => periodRangesFromDays(periodDays), [periodDays])

  function dayNumberInPeriod(iso: string): number | null {
    for (const r of ranges) {
      if (iso >= r.start && iso <= r.end) {
        return diffDays(r.start, iso) + 1
      }
    }
    return null
  }

  function cellClass(iso: string | null): string {
    if (!iso) return 'cal-cell empty'
    const classes = ['cal-cell']
    if (iso === today) classes.push('is-today')
    if (periodSet.has(iso)) classes.push('is-period')
    if (prediction.nextPeriodStart === iso) classes.push('is-predict-period')
    if (prediction.predictedOvulation === iso) classes.push('is-predict-ovulation')
    return classes.join(' ')
  }

  return (
    <div className="panel calendar-panel">
      <header className="cal-toolbar">
        <button
          type="button"
          className="ghost"
          onClick={() => setCursor(startOfMonth(addMonths(cursor, -1)))}
          aria-label="上個月"
        >
          ‹
        </button>
        <h2>{formatMonthLabel(year, month)}</h2>
        <button
          type="button"
          className="ghost"
          onClick={() => setCursor(startOfMonth(addMonths(cursor, 1)))}
          aria-label="下個月"
        >
          ›
        </button>
      </header>

      <p className="muted small cal-hint">
        點選日期可加入／取消經期標記（本地儲存）。
      </p>

      <div className="weekday-row">
        {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
          <span key={w} className="weekday">
            {w}
          </span>
        ))}
      </div>

      <div className="cal-grid">
        {grid.map((iso, idx) => {
          if (!iso) {
            return <div key={`e-${idx}`} className={cellClass(null)} />
          }
          const n = dayNumberInPeriod(iso)
          return (
            <button
              key={iso}
              type="button"
              className={cellClass(iso)}
              onClick={() => onToggleDay(iso)}
            >
              <span className="cal-day-num">{parseISOToLocal(iso).getDate()}</span>
              {n != null && <span className="cal-period-idx">{n}</span>}
              {iso === today && <span className="cal-today-tag">今天</span>}
            </button>
          )
        })}
      </div>

      <ul className="legend muted small">
        <li>
          <span className="dot period" /> 已標記經期
        </li>
        <li>
          <span className="dot predict-p" /> 預估經期開始
        </li>
        <li>
          <span className="dot predict-o" /> 預估排卵日
        </li>
      </ul>
    </div>
  )
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1)
}
