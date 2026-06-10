import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Flower2, Settings } from 'lucide-react'
import { CalendarView } from './components/CalendarView'
import { SettingsView } from './components/SettingsView'
import { TodayView } from './components/TodayView'
import { addDays, enumerateInclusive } from './dates'
import {
  computePrediction,
  periodRangesFromDays,
  wouldCreateSeparatePeriodInSameMonth,
} from './cycleMath'
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
  /** 避免行動版瀏覽器：開啟對話框後同一串觸控產生的「幽靈點擊」立刻打中 backdrop 而關閉 */
  const pendingSecondPeriodOpenedAtRef = useRef(0)

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.themeName
  }, [state.settings.themeName])

  const prediction = useMemo(
    () =>
      computePrediction({
        periodDays: state.periodDays,
        cycleAnchors: state.cycleAnchors,
        settings: state.settings,
      }),
    [state.periodDays, state.cycleAnchors, state.settings],
  )

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
          cycleAnchors: s.cycleAnchors.filter((a) => a !== hit.start),
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
      pendingSecondPeriodOpenedAtRef.current = Date.now()
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
      const cycleAnchors = [...new Set([...s.cycleAnchors, iso])].sort()
      return { ...s, periodDays: [...next].sort(), cycleAnchors }
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
        cycleAnchors: s.cycleAnchors.filter((a) => a !== hit.start),
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
            onPatchStyle={(p) =>
              setState((s) => ({
                ...s,
                settings: { ...s.settings, ...p },
              }))
            }
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
            cycleAnchors={state.cycleAnchors}
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
          className="cal-sheet-backdrop app-second-period-confirm"
          role="presentation"
          onClick={() => {
            if (Date.now() - pendingSecondPeriodOpenedAtRef.current < 450) {
              return
            }
            setPendingSecondPeriod(null)
          }}
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
          <Flower2 className="nav-ic" size={20} strokeWidth={2.1} aria-hidden />
          今天
        </button>
        <button
          type="button"
          className={tab === 'calendar' ? 'nav-item active' : 'nav-item'}
          onClick={() => setTab('calendar')}
        >
          <CalendarDays className="nav-ic" size={20} strokeWidth={2.1} aria-hidden />
          日曆
        </button>
        <button
          type="button"
          className={tab === 'settings' ? 'nav-item active' : 'nav-item'}
          onClick={() => setTab('settings')}
        >
          <Settings className="nav-ic" size={20} strokeWidth={2.1} aria-hidden />
          設定
        </button>
      </nav>
    </div>
  )
}
