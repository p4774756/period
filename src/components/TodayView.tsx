import {
  bodyPhaseLine,
  riskNote,
  todayStatusChip,
} from '../copy'
import { diffDays, formatChineseDay, todayISO } from '../dates'
import type { CyclePrediction } from '../cycleMath'
import { inferBodyPhase, inferRiskLevel } from '../phase'
import type { AppState } from '../types'

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
  onOpenSettings,
}: {
  state: AppState
  prediction: CyclePrediction
  onOpenSettings: () => void
}) {
  const goal = state.settings.goal
  const phase = inferBodyPhase(prediction)
  const risk = inferRiskLevel(prediction)
  const ov = formatCountdown(prediction.predictedOvulation)
  const pd = formatCountdown(prediction.nextPeriodStart)

  return (
    <div className="panel today">
      <header className="today-header">
        <h1 className="today-title">{formatChineseDay(todayISO())}</h1>
        <button type="button" className="ghost" onClick={onOpenSettings}>
          設定
        </button>
      </header>

      <section className="card hero-card hero-card--minimal">
        <p className="status-chip">{todayStatusChip(goal, risk, phase)}</p>

        <div className="countdown-block">
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
            在下方「日曆」點日期可標記經期；紀錄越多，預測越準。
          </p>
        </div>
      </details>
    </div>
  )
}
