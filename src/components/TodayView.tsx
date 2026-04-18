import {
  bodyPhaseLine,
  riskNote,
  todayStatusChip,
} from '../copy'
import { addDays, diffDays, formatChineseDay, todayISO } from '../dates'
import type { CyclePrediction } from '../cycleMath'
import { inferBodyPhase, inferRiskLevel } from '../phase'
import { useState } from 'react'
import {
  MASCOT_LABEL,
  type AppSettings,
  type AppState,
  type MascotAnimal,
  type ThemeName,
} from '../types'
import { MascotIcon } from './MascotIcon'

function formatCountdown(target: string | null): string | null {
  if (!target) return null
  const n = diffDays(todayISO(), target)
  if (n === 0) return '今天'
  if (n > 0) return `還有 ${n} 天`
  return `已過 ${-n} 天`
}

export function TodayView({
  state,
  prediction,
  onPatchStyle,
}: {
  state: AppState
  prediction: CyclePrediction
  onPatchStyle: (p: Partial<AppSettings>) => void
}) {
  const goal = state.settings.goal
  const phase = inferBodyPhase(prediction)
  const risk = inferRiskLevel(prediction)
  const ov = formatCountdown(prediction.predictedOvulation)
  const fertile = prediction.predictedOvulation
    ? formatCountdown(addDays(prediction.predictedOvulation, -5))
    : null
  const pd = formatCountdown(prediction.nextPeriodStart)
  const [showStyleModal, setShowStyleModal] = useState(false)

  const animals: MascotAnimal[] = ['rabbit', 'cat', 'bear', 'dog', 'panda', 'fox']

  return (
    <div className="panel today">
      <header className="today-header">
        <h1 className="today-title">{formatChineseDay(todayISO())}</h1>
      </header>

      <section className="card hero-card hero-card--minimal">
        <button
          type="button"
          className="mascot-fab"
          onClick={() => setShowStyleModal(true)}
          aria-label="切換可愛動物與主題"
          title="切換可愛動物與主題"
        >
          <MascotIcon
            animal={state.settings.mascotAnimal}
            className="mascot-img"
            priority
          />
        </button>
        <p className="status-chip">{todayStatusChip(goal, risk, phase)}</p>

        <div className="countdown-block">
          <div className="countdown-row">
            <span className="countdown-label">排卵期（推估）</span>
            <span className="countdown-value">
              {fertile ?? '—'}
            </span>
          </div>
          <div className="countdown-row">
            <span className="countdown-label">排卵（推估）</span>
            <span className="countdown-value">
              {ov ?? '—'}
            </span>
          </div>
          <div className="countdown-row">
            <span className="countdown-label">經期（推估）</span>
            <span className="countdown-value">
              {pd ?? '—'}
            </span>
          </div>
        </div>

        <div className="cycle-strip">
          <div className="cycle-day-pill" aria-label="週期天數">
            <span className="big-num">
              {prediction.cycleDay != null ? prediction.cycleDay : '—'}
            </span>
            <span className="tiny-label">第幾天</span>
          </div>
        </div>
      </section>

      <details className="today-details">
        <summary>詳細說明</summary>
        <div className="details-body">
          <p className="muted small">{riskNote(goal)}</p>
          <p className="muted small">{bodyPhaseLine(goal, phase)}</p>
          <p className="muted tiny">
            週期平均 {prediction.avgCycleDays} 天
            {prediction.cycleFromHistory ? '（依紀錄）' : '（預設）'}・經期平均{' '}
            {prediction.avgPeriodDays} 天
            {prediction.periodFromHistory ? '（依紀錄）' : '（預設）'}
          </p>
          <p className="muted small">
            在「日曆」點經期開始日會自動帶出平均天數；點已標記日可整段取消。紀錄越多越準。
          </p>
        </div>
      </details>

      {showStyleModal && (
        <div
          className="cal-sheet-backdrop"
          role="presentation"
          onClick={() => setShowStyleModal(false)}
        >
          <div
            className="cal-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="選擇動物與主題"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="cal-sheet-date muted small">可愛動物與主題</p>
            <p className="muted tiny cal-sheet-hint">點兔子可隨時切換。</p>

            <div className="style-grid">
              {animals.map((animal) => (
                <button
                  key={animal}
                  type="button"
                  className={`style-chip mascot-style-chip${
                    state.settings.mascotAnimal === animal ? ' active' : ''
                  }`}
                  aria-label={`切換吉祥物：${MASCOT_LABEL[animal]}`}
                  onClick={() => onPatchStyle({ mascotAnimal: animal })}
                >
                  <MascotIcon animal={animal} className="mascot-img" />
                </button>
              ))}
            </div>

            <div className="theme-grid">
              {(
                [
                  ['sakura', '櫻花'],
                  ['mint', '薄荷'],
                  ['sunset', '奶油'],
                  ['night', '夜空'],
                ] as const
              ).map(([theme, label]) => (
                <button
                  key={theme}
                  type="button"
                  className={
                    state.settings.themeName === theme
                      ? 'theme-chip active'
                      : 'theme-chip'
                  }
                  onClick={() => onPatchStyle({ themeName: theme as ThemeName })}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="cal-sheet-btn cal-sheet-btn-cancel"
              onClick={() => setShowStyleModal(false)}
            >
              完成
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
