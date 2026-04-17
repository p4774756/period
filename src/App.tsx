import { useEffect, useMemo, useState } from 'react'
import { CalendarView } from './components/CalendarView'
import { SettingsView } from './components/SettingsView'
import { TodayView } from './components/TodayView'
import { addDays, enumerateInclusive } from './dates'
import {
  computePrediction,
  periodRangesFromDays,
  wouldCreateSeparatePeriodInSameMonth,
} from './cycleMath'
import { checkAndNotify } from './notifications'
import { loadState, saveState } from './storage'
import type { AppState } from './types'
import './App.css'

type Tab = 'today' | 'calendar' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [state, setState] = useState<AppState>(() => loadState())
  const [pendingSecondPeriod, setPendingSecondPeriod] = useState<{
    iso: string
    blockLen: number
  } | null>(null)

  useEffect(() => {
    saveState(state)
  }, [state])

  const prediction = useMemo(
    () =>
      computePrediction({
        periodDays: state.periodDays,
        settings: state.settings,
      }),
    [state.periodDays, state.settings],
  )

  useEffect(() => {
    const tick = () => {
      const { notificationSent } = checkAndNotify(state, prediction, new Date())
      if (notificationSent !== state.notificationSent) {
        setState((s) => ({ ...s, notificationSent }))
      }
    }
    tick()
    const id = window.setInterval(tick, 60_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [state, prediction])

  /** 日曆：點空白日＝從該日起自動標記平均經期長度；點已標記日＝移除整段連續經期 */
  function handleCalendarDay(iso: string) {
    const blockLen = Math.max(
      2,
      Math.min(14, prediction.avgPeriodDays),
    )
    const markedNow = new Set(state.periodDays)
    if (markedNow.has(iso)) {
      setState((s) => {
        const ranges = periodRangesFromDays(s.periodDays)
        const hit = ranges.find((r) => iso >= r.start && iso <= r.end)
        if (!hit) return s
        const drop = new Set(enumerateInclusive(hit.start, hit.end))
        return {
          ...s,
          periodDays: s.periodDays.filter((d) => !drop.has(d)),
        }
      })
      return
    }
    if (
      wouldCreateSeparatePeriodInSameMonth(
        state.periodDays,
        iso,
        blockLen,
      )
    ) {
      setPendingSecondPeriod({ iso, blockLen })
      return
    }
    addPeriodBlock(iso, blockLen)
  }

  function addPeriodBlock(iso: string, blockLen: number) {
    setState((s) => {
      const next = new Set(s.periodDays)
      for (let i = 0; i < blockLen; i++) {
        next.add(addDays(iso, i))
      }
      return { ...s, periodDays: [...next].sort() }
    })
  }

  function deletePeriodRange(iso: string) {
    setState((s) => {
      const marked = new Set(s.periodDays)
      if (!marked.has(iso)) return s
      const ranges = periodRangesFromDays(s.periodDays)
      const hit = ranges.find((r) => iso >= r.start && iso <= r.end)
      if (!hit) return s
      const drop = new Set(enumerateInclusive(hit.start, hit.end))
      return {
        ...s,
        periodDays: s.periodDays.filter((d) => !drop.has(d)),
      }
    })
  }

  /** 以該日為最後一天，移除同段經期中更晚的日期（修正多估） */
  function endPeriodAt(iso: string) {
    setState((s) => {
      const ranges = periodRangesFromDays(s.periodDays)
      const hit = ranges.find((r) => iso >= r.start && iso <= r.end)
      if (!hit) return s
      const toRemove = new Set<string>()
      let cur = addDays(iso, 1)
      while (cur <= hit.end) {
        toRemove.add(cur)
        cur = addDays(cur, 1)
      }
      if (toRemove.size === 0) return s
      return {
        ...s,
        periodDays: s.periodDays.filter((d) => !toRemove.has(d)),
      }
    })
  }

  function saveDayNote(iso: string, note: string) {
    setState((s) => {
      const next = { ...s.dayNotes }
      const t = note.trim()
      if (t) next[iso] = t
      else delete next[iso]
      return { ...s, dayNotes: next }
    })
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        {tab === 'today' && (
          <TodayView
            state={state}
            prediction={prediction}
            onOpenSettings={() => setTab('settings')}
          />
        )}
        {tab === 'calendar' && (
          <CalendarView
            settings={state.settings}
            onPatchCalendarSettings={(p) =>
              setState((s) => ({
                ...s,
                settings: { ...s.settings, ...p },
              }))
            }
            periodDays={state.periodDays}
            dayNotes={state.dayNotes}
            prediction={prediction}
            onDayActivate={handleCalendarDay}
            onDeletePeriodRange={deletePeriodRange}
            onEndPeriodAt={endPeriodAt}
            onSaveDayNote={saveDayNote}
          />
        )}
        {tab === 'settings' && (
          <SettingsView
            state={state}
            onChange={setState}
            onBack={() => setTab('today')}
          />
        )}
      </main>

      {pendingSecondPeriod && (
        <div
          className="cal-sheet-backdrop"
          role="presentation"
          onClick={() => setPendingSecondPeriod(null)}
        >
          <div
            className="cal-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="再次確認新增經期"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="cal-sheet-date muted small">提醒</p>
            <p className="muted small cal-sheet-hint">
              這個月份已經有一段生理期紀錄了，通常不會同月出現兩次。已經有了，確定要按嗎？
            </p>
            <button
              type="button"
              className="cal-sheet-btn"
              onClick={() => {
                addPeriodBlock(
                  pendingSecondPeriod.iso,
                  pendingSecondPeriod.blockLen,
                )
                setPendingSecondPeriod(null)
              }}
            >
              確定增加
            </button>
            <button
              type="button"
              className="cal-sheet-btn cal-sheet-btn-cancel"
              onClick={() => setPendingSecondPeriod(null)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      <nav className="bottom-nav" aria-label="主要導覽">
        <button
          type="button"
          className={tab === 'today' ? 'nav-item active' : 'nav-item'}
          onClick={() => setTab('today')}
        >
          <span className="nav-ic" aria-hidden>
            🌸
          </span>
          今天
        </button>
        <button
          type="button"
          className={tab === 'calendar' ? 'nav-item active' : 'nav-item'}
          onClick={() => setTab('calendar')}
        >
          <span className="nav-ic" aria-hidden>
            📅
          </span>
          日曆
        </button>
        <button
          type="button"
          className={tab === 'settings' ? 'nav-item active' : 'nav-item'}
          onClick={() => setTab('settings')}
        >
          <span className="nav-ic" aria-hidden>
            ⚙︎
          </span>
          設定
        </button>
      </nav>
    </div>
  )
}
