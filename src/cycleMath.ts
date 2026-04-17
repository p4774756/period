import { addDays, diffDays, parseISOToLocal, todayISO } from './dates'
import type { AppSettings } from './types'

export interface PeriodRange {
  start: string
  end: string
}

/** 將不重複、已排序的經期日期合併為連續區間 */
export function periodRangesFromDays(periodDays: string[]): PeriodRange[] {
  const sorted = [...new Set(periodDays)].sort()
  const ranges: PeriodRange[] = []
  let i = 0
  while (i < sorted.length) {
    const start = sorted[i]
    let end = start
    let j = i + 1
    while (j < sorted.length) {
      const expectedNext = addDays(end, 1)
      if (sorted[j] === expectedNext) {
        end = sorted[j]
        j++
      } else {
        break
      }
    }
    ranges.push({ start, end })
    i = j
  }
  return ranges
}

function roundAvg(nums: number[]): number {
  if (nums.length === 0) return 0
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

/** 每次經期長度（含首尾日） */
export function periodLengths(ranges: PeriodRange[]): number[] {
  return ranges.map((r) => diffDays(r.start, r.end) + 1)
}

/** 週期長度：相鄰兩次經期「開始日」間隔天數 */
export function cycleLengthsFromStarts(starts: string[]): number[] {
  if (starts.length < 2) return []
  const out: number[] = []
  for (let i = 1; i < starts.length; i++) {
    out.push(diffDays(starts[i - 1], starts[i]))
  }
  return out
}

export function averageLastN(values: number[], n: number): number | null {
  if (values.length === 0) return null
  const slice = values.slice(-Math.min(n, values.length))
  return roundAvg(slice)
}

export interface PredictionInput {
  periodDays: string[]
  settings: AppSettings
  /** 用於測試；預設今天 */
  asOf?: string
}

export interface CyclePrediction {
  avgCycleDays: number
  avgPeriodDays: number
  cycleFromHistory: boolean
  periodFromHistory: boolean
  lastPeriodStart: string | null
  nextPeriodStart: string | null
  predictedOvulation: string | null
  cycleDay: number | null
  /** 今天是否在標記的經期內 */
  onPeriod: boolean
  completedCycleCount: number
}

export function computePrediction(input: PredictionInput): CyclePrediction {
  const asOf = input.asOf ?? todayISO()
  const ranges = periodRangesFromDays(input.periodDays)
  const starts = ranges.map((r) => r.start).sort()
  const cycles = cycleLengthsFromStarts(starts)
  const periods = periodLengths(ranges)

  const avgCycleFromHistory = averageLastN(cycles, 3)
  const avgPeriodFromHistory = averageLastN(periods, 3)

  const avgCycleDays =
    avgCycleFromHistory ?? Math.max(21, Math.min(45, input.settings.defaultCycleDays))
  const avgPeriodDays =
    avgPeriodFromHistory ?? Math.max(2, Math.min(14, input.settings.defaultPeriodDays))

  const cycleFromHistory = avgCycleFromHistory != null
  const periodFromHistory = avgPeriodFromHistory != null

  const relevantRanges = ranges.filter((r) => r.start <= asOf)
  const lastRange =
    relevantRanges.length > 0 ? relevantRanges[relevantRanges.length - 1] : null
  const lastPeriodStart = lastRange?.start ?? null

  const onPeriod = ranges.some((r) => asOf >= r.start && asOf <= r.end)

  let nextPeriodStart: string | null = null
  let predictedOvulation: string | null = null
  let cycleDay: number | null = null

  if (lastPeriodStart) {
    nextPeriodStart = addDays(lastPeriodStart, avgCycleDays)
    predictedOvulation = addDays(nextPeriodStart, -14)
    cycleDay = diffDays(lastPeriodStart, asOf) + 1
    if (cycleDay < 1) cycleDay = 1
  }

  return {
    avgCycleDays,
    avgPeriodDays,
    cycleFromHistory,
    periodFromHistory,
    lastPeriodStart,
    nextPeriodStart,
    predictedOvulation,
    cycleDay,
    onPeriod,
    completedCycleCount: cycles.length,
  }
}

export function daysUntil(from: string, to: string | null): number | null {
  if (!to) return null
  const n = diffDays(from, to)
  return n
}

/** 是否在 [reminderDay, eventDay) 之間顯示「已過提醒點」的推播（含 reminder 當天到事件日前） */
export function reminderFireDate(eventISO: string, advanceDays: number): string {
  return addDays(eventISO, -advanceDays)
}

export function isAtOrPastReminderTime(
  now: Date,
  reminderDayISO: string,
  hour: number,
  minute: number,
): boolean {
  const d = parseISOToLocal(reminderDayISO)
  d.setHours(hour, minute, 0, 0)
  return now.getTime() >= d.getTime()
}

/** 事件日當天結束前仍算在提醒週期內（避免漏推） */
export function isBeforeEventEnd(now: Date, eventDayISO: string): boolean {
  const end = parseISOToLocal(eventDayISO)
  end.setHours(23, 59, 59, 999)
  return now.getTime() <= end.getTime()
}
