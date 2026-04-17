import { useEffect, useMemo, useState } from 'react'
import { CalendarView } from './components/CalendarView'
import { SettingsView } from './components/SettingsView'
import { TodayView } from './components/TodayView'
import { computePrediction } from './cycleMath'
import { checkAndNotify } from './notifications'
import { loadState, saveState } from './storage'
import type { AppState } from './types'
import './App.css'

type Tab = 'today' | 'calendar' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [state, setState] = useState<AppState>(() => loadState())

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

  function toggleDay(iso: string) {
    setState((s) => {
      const set = new Set(s.periodDays)
      if (set.has(iso)) set.delete(iso)
      else set.add(iso)
      return { ...s, periodDays: [...set].sort() }
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
            periodDays={state.periodDays}
            prediction={prediction}
            onToggleDay={toggleDay}
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
