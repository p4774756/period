import {
  bodyPhaseLine,
  riskHeadline,
  riskNote,
} from '../copy'
import { diffDays, todayISO } from '../dates'
import type { CyclePrediction } from '../cycleMath'
import { inferBodyPhase, inferRiskLevel } from '../phase'
import type { AppState } from '../types'

function formatRelative(label: string, target: string | null): string {
  if (!target) return `${label}：尚無法推估（請先紀錄經期）`
  const n = diffDays(todayISO(), target)
  if (n === 0) return `${label}：今天`
  if (n > 0) return `${label}：${n} 天之後`
  return `${label}：已過 ${-n} 天`
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
  const cycleDayText =
    prediction.cycleDay != null
      ? `週期第 ${prediction.cycleDay} 天`
      : '尚未建立週期資訊'

  return (
    <div className="panel today">
      <header className="today-header">
        <div>
          <p className="muted small">{todayISO().replace(/-/g, '／')}</p>
          <h1>今天</h1>
        </div>
        <button type="button" className="ghost" onClick={onOpenSettings}>
          設定
        </button>
      </header>

      <section className="card hero-card">
        <p className="risk-label">{riskHeadline(goal, risk)}</p>
        <p className="muted small">{riskNote(goal)}</p>

        <h2 className="predict-primary">
          {formatRelative('預估排卵日', prediction.predictedOvulation)}
        </h2>
        <p className="predict-secondary">
          {formatRelative('預估下次經期開始', prediction.nextPeriodStart)}
        </p>

        <p className="muted tiny">
          週期平均 {prediction.avgCycleDays} 天
          {prediction.cycleFromHistory ? '（最近紀錄）' : '（預設值）'}
          ・經期平均 {prediction.avgPeriodDays} 天
          {prediction.periodFromHistory ? '（最近紀錄）' : '（預設值）'}
        </p>
      </section>

      <section className="card phase-card">
        <div className="phase-row">
          <div>
            <h3>身體階段（推估）</h3>
            <p className="phase-text">{bodyPhaseLine(goal, phase)}</p>
          </div>
          <div className="cycle-day-pill">
            <span className="big-num">
              {prediction.cycleDay != null ? prediction.cycleDay : '—'}
            </span>
            <span className="tiny-label">週期天數</span>
          </div>
        </div>
        <p className="muted small">{cycleDayText}</p>
      </section>

      <p className="muted small center foot-hint">
        到「日曆」點選日期即可標記經期。紀錄越完整，預測越穩定（以最近 3
        次完整資料為優先）。
      </p>
    </div>
  )
}
