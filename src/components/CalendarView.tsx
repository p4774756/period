import { Droplet, Flower2, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  diffDays,
  formatChineseDay,
  formatMonthLabel,
  parseISOToLocal,
  toISODateLocal,
  todayISO,
} from '../dates'
import {
  cycleDayNumberForDate,
  periodRangesFromDays,
  projectedFertileWindowDates,
  projectedOvulationDates,
  projectedPeriodRanges,
  type CyclePrediction,
} from '../cycleMath'
import type { AppSettings, WeekStart } from '../types'
import { CalendarDisplaySheet } from './CalendarDisplaySheet'

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function buildMonthGrid(
  year: number,
  monthIndex0: number,
  weekStartsOn: WeekStart,
): (string | null)[] {
  const first = new Date(year, monthIndex0, 1)
  const startWeekday = first.getDay()
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate()
  const pad =
    weekStartsOn === 'monday' ? (startWeekday + 6) % 7 : startWeekday
  const cells: (string | null)[] = []
  for (let i = 0; i < pad; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    const dt = new Date(year, monthIndex0, day)
    cells.push(toISODateLocal(dt))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const LONG_PRESS_MS = 550

export function CalendarView({
  settings,
  onPatchCalendarSettings,
  periodDays,
  cycleAnchors,
  dayNotes,
  prediction,
  onDayActivate,
  onDeletePeriodRange,
  onEndPeriodAt,
  onSaveDayNote,
}: {
  settings: AppSettings
  onPatchCalendarSettings: (p: Partial<AppSettings>) => void
  periodDays: string[]
  cycleAnchors: string[]
  dayNotes: Record<string, string>
  prediction: CyclePrediction
  onDayActivate: (iso: string) => void
  onDeletePeriodRange: (iso: string) => void
  onEndPeriodAt: (iso: string) => void
  onSaveDayNote: (iso: string, note: string) => void
}) {
  const [cursor, setCursor] = useState(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), 1)
  })
  const [menuDate, setMenuDate] = useState<string | null>(null)
  const [recordIso, setRecordIso] = useState<string | null>(null)
  const [recordDraft, setRecordDraft] = useState('')
  const [displaySheetOpen, setDisplaySheetOpen] = useState(false)

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activePressIsoRef = useRef<string | null>(null)
  /** 讓觸控軌跡留在同一格子上，避免小格子上擡手前 pointerleave 吃掉短按 */
  const pointerCaptureRef = useRef<{ pointerId: number; node: HTMLElement } | null>(
    null,
  )

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const grid = useMemo(
    () => buildMonthGrid(year, month, settings.weekStartsOn),
    [year, month, settings.weekStartsOn],
  )
  const today = todayISO()

  const periodSet = useMemo(() => new Set(periodDays), [periodDays])
  const ranges = useMemo(() => periodRangesFromDays(periodDays), [periodDays])
  const projectedRanges = useMemo(
    () => projectedPeriodRanges(prediction, 12),
    [prediction],
  )
  const projectedSet = useMemo(() => {
    const s = new Set<string>()
    for (const r of projectedRanges) {
      const block = enumerateDates(r.start, r.end)
      for (const d of block) s.add(d)
    }
    return s
  }, [projectedRanges])
  const projectedOvulationSet = useMemo(
    () => new Set(projectedOvulationDates(prediction, 12)),
    [prediction],
  )
  const fertileSet = useMemo(
    () => new Set(projectedFertileWindowDates(prediction, 12)),
    [prediction],
  )

  const blockLen = Math.max(
    2,
    Math.min(14, prediction.avgPeriodDays || 5),
  )

  const weekdayLabels =
    settings.weekStartsOn === 'monday'
      ? ['一', '二', '三', '四', '五', '六', '日']
      : ['日', '一', '二', '三', '四', '五', '六']

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }
      const c = pointerCaptureRef.current
      if (c) {
        try {
          c.node.releasePointerCapture(c.pointerId)
        } catch {
          /* noop */
        }
        pointerCaptureRef.current = null
      }
    }
  }, [])

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  function releaseDayPointerCapture() {
    const c = pointerCaptureRef.current
    if (!c) return
    try {
      if (c.node.releasePointerCapture) {
        c.node.releasePointerCapture(c.pointerId)
      }
    } catch {
      /* 某些環境在 pointerup 後再釋放會拋錯，忽略即可 */
    }
    pointerCaptureRef.current = null
  }

  function handleDayPointerDown(
    iso: string,
    e: React.PointerEvent<HTMLButtonElement>,
  ) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    activePressIsoRef.current = iso
    clearLongPressTimer()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
      pointerCaptureRef.current = { pointerId: e.pointerId, node: e.currentTarget }
    } catch {
      pointerCaptureRef.current = null
    }
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null
      activePressIsoRef.current = null
      releaseDayPointerCapture()
      setMenuDate(iso)
    }, LONG_PRESS_MS)
  }

  function handleDayPointerUp() {
    const iso = activePressIsoRef.current
    if (longPressTimerRef.current != null && iso) {
      clearLongPressTimer()
      onDayActivate(iso)
    }
    releaseDayPointerCapture()
    activePressIsoRef.current = null
  }

  function handleDayPointerCancel() {
    clearLongPressTimer()
    releaseDayPointerCapture()
    activePressIsoRef.current = null
  }

  function dayNumberInPeriod(iso: string): number | null {
    for (const r of ranges) {
      if (iso >= r.start && iso <= r.end) {
        return diffDays(r.start, iso) + 1
      }
    }
    return null
  }

  function dayNumberInProjected(iso: string): number | null {
    for (const r of projectedRanges) {
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
    if (periodSet.has(iso)) {
      if (settings.calendarShowPeriod) classes.push('is-period')
      else classes.push('is-period-hidden')
    }
    if (
      settings.calendarShowPredictPeriodStart &&
      projectedSet.has(iso) &&
      !periodSet.has(iso)
    ) {
      classes.push('is-predict-period-fill')
    }
    if (dayNotes[iso]) classes.push('has-note')
    if (
      settings.calendarShowPredictPeriodStart &&
      prediction.nextPeriodStart === iso
    ) {
      classes.push('is-predict-period')
    }
    if (
      settings.calendarShowOvulation &&
      prediction.predictedOvulation === iso
    ) {
      classes.push('is-predict-ovulation')
    }
    return classes.join(' ')
  }

  const inPeriod = menuDate != null && periodSet.has(menuDate)

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
          className="ghost cal-open-display"
          onClick={() => setDisplaySheetOpen(true)}
          aria-label="日曆顯示與圖例"
        >
          <Settings2 size={20} strokeWidth={2} />
        </button>
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
        輕點<strong>開始日</strong>：自動連續標記 <strong>{blockLen} 天</strong>
        。輕點<strong>已標記日</strong>：整段取消。
        <strong>長按任一天</strong>可編輯（刪除、提早結束、備註）。
        點右上角 <Settings2 size={14} className="cal-inline-ic" strokeWidth={2} />{' '}
        可調整圖示與圖例。
      </p>

      <div className="weekday-row">
        {weekdayLabels.map((w) => (
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
          const periodDayIdx = dayNumberInPeriod(iso)
          const projectedDayIdx = dayNumberInProjected(iso)
          const cycleNum = cycleDayNumberForDate(
            iso,
            cycleAnchors,
            prediction.avgCycleDays,
          )
          const showCycleNum =
            settings.calendarShowCycleDay && cycleNum != null
          const showOvIc =
            settings.calendarShowOvulation &&
            projectedOvulationSet.has(iso)
          const showFertileIc =
            settings.calendarShowFertileWindow &&
            fertileSet.has(iso) &&
            !periodSet.has(iso) &&
            !projectedOvulationSet.has(iso)

          return (
            <button
              key={iso}
              type="button"
              className={cellClass(iso)}
              onPointerDown={(e) => handleDayPointerDown(iso, e)}
              onPointerUp={handleDayPointerUp}
              onPointerCancel={handleDayPointerCancel}
              onPointerLeave={handleDayPointerCancel}
              onContextMenu={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onDayActivate(iso)
                }
              }}
            >
              <span className="cal-day-num">{parseISOToLocal(iso).getDate()}</span>
              {showCycleNum && (
                <span className="cal-cycle-idx">{cycleNum}</span>
              )}
              {!showCycleNum &&
                settings.calendarShowPeriod &&
                periodDayIdx != null && (
                  <span className="cal-period-idx">{periodDayIdx}</span>
                )}
              {!showCycleNum &&
                settings.calendarShowPredictPeriodStart &&
                periodDayIdx == null &&
                projectedDayIdx != null && (
                  <span className="cal-period-idx">{projectedDayIdx}</span>
                )}
              {showOvIc && (
                <span className="cal-cell-ic cal-cell-ic-ov" title="排卵日（推估）">
                  <Droplet size={13} strokeWidth={2.25} aria-hidden />
                </span>
              )}
              {showFertileIc && (
                <span className="cal-cell-ic cal-cell-ic-fertile" title="受孕期（推估）">
                  <Flower2 size={13} strokeWidth={2} aria-hidden />
                </span>
              )}
              {iso === today && <span className="cal-today-tag">今天</span>}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="cal-legend-open secondary wide"
        onClick={() => setDisplaySheetOpen(true)}
      >
        <Settings2 size={18} strokeWidth={2} className="cal-legend-open-ic" />
        日曆顯示與圖例
      </button>

      <CalendarDisplaySheet
        open={displaySheetOpen}
        settings={settings}
        onClose={() => setDisplaySheetOpen(false)}
        onPatch={onPatchCalendarSettings}
      />

      {menuDate != null && (
        <div
          className="cal-sheet-backdrop"
          role="presentation"
          onClick={() => setMenuDate(null)}
        >
          <div
            className="cal-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="日曆選單"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="cal-sheet-date muted small">
              {formatChineseDay(menuDate)}
            </p>
            <button
              type="button"
              className="cal-sheet-btn danger"
              disabled={!inPeriod}
              onClick={() => {
                if (inPeriod) onDeletePeriodRange(menuDate)
                setMenuDate(null)
              }}
            >
              刪除生理期
            </button>
            <button
              type="button"
              className="cal-sheet-btn"
              disabled={!inPeriod}
              onClick={() => {
                if (inPeriod) onEndPeriodAt(menuDate)
                setMenuDate(null)
              }}
            >
              生理期結束
            </button>
            <p className="cal-sheet-hint muted tiny">
              「生理期結束」會保留到這天為止，去掉後面多估的天數。
            </p>
            <button
              type="button"
              className="cal-sheet-btn"
              onClick={() => {
                const d = menuDate
                setMenuDate(null)
                if (d) setRecordDraft(dayNotes[d] ?? '')
                setRecordIso(d)
              }}
            >
              記錄
            </button>
            <button
              type="button"
              className="cal-sheet-btn"
              onClick={() => {
                setMenuDate(null)
                setDisplaySheetOpen(true)
              }}
            >
              圖例
            </button>
            <button
              type="button"
              className="cal-sheet-btn cal-sheet-btn-cancel"
              onClick={() => setMenuDate(null)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {recordIso != null && (
        <div
          className="cal-sheet-backdrop"
          role="presentation"
          onClick={() => setRecordIso(null)}
        >
          <div
            className="cal-sheet cal-sheet-record"
            role="dialog"
            aria-modal="true"
            aria-label="備註"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="cal-sheet-date muted small">
              {formatChineseDay(recordIso)}
            </p>
            <label className="cal-record-label">
              備註（選填）
              <textarea
                className="cal-record-textarea"
                value={recordDraft}
                onChange={(e) => setRecordDraft(e.target.value)}
                rows={4}
                placeholder="例如：經痛、血量、心情…"
              />
            </label>
            <button
              type="button"
              className="cal-sheet-btn"
              onClick={() => {
                onSaveDayNote(recordIso, recordDraft)
                setRecordIso(null)
              }}
            >
              儲存
            </button>
            <button
              type="button"
              className="cal-sheet-btn cal-sheet-btn-cancel"
              onClick={() => setRecordIso(null)}
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1)
}

function enumerateDates(start: string, end: string): string[] {
  const out: string[] = []
  let cur = start
  let guard = 0
  while (guard++ < 62) {
    out.push(cur)
    if (cur === end) break
    const d = parseISOToLocal(cur)
    d.setDate(d.getDate() + 1)
    cur = toISODateLocal(d)
  }
  return out
}
