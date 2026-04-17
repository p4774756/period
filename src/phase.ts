import { diffDays, todayISO } from './dates'
import type { CyclePrediction } from './cycleMath'

export type BodyPhase = 'period' | 'follicular' | 'fertile' | 'luteal'

export function inferBodyPhase(pred: CyclePrediction): BodyPhase {
  const asOf = todayISO()
  if (pred.onPeriod) return 'period'
  if (!pred.predictedOvulation) return 'follicular'
  const d = diffDays(asOf, pred.predictedOvulation)
  if (d >= -2 && d <= 2) return 'fertile'
  if (d < -2) return 'luteal'
  return 'follicular'
}

export function inferRiskLevel(pred: CyclePrediction): 'low' | 'mid' | 'high' {
  const asOf = todayISO()
  if (pred.onPeriod) return 'low'
  if (!pred.predictedOvulation) return 'low'
  const d = diffDays(asOf, pred.predictedOvulation)
  if (d >= -1 && d <= 1) return 'high'
  if (d >= -3 && d <= 3) return 'mid'
  return 'low'
}
