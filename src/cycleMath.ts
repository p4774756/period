import {
  addDays,
  diffDays,
  enumerateInclusive,
  lastDayOfCalendarMonth,
  todayISO,
} from './dates'
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

/** 與某曆月（YYYY-MM）有交集的經期區間 */
export function rangesOverlappingCalendarMonth(
  ranges: PeriodRange[],
  ym: string,
): PeriodRange[] {
  const first = `${ym}-01`
  const last = lastDayOfCalendarMonth(ym)
  return ranges.filter((r) => r.start <= last && r.end >= first)
}

/**
 * 若從 newBlockStart 起連續加入 blockDayCount 天，是否會在「這段新區間所經過的任一曆月」
 * 出現兩段以上不相連的經期（同一月內兩次出血區間）。
 */
export function wouldCreateSeparatePeriodInSameMonth(
  periodDays: string[],
  newBlockStart: string,
  blockDayCount: number,
): boolean {
  const toAdd: string[] = []
  for (let i = 0; i < blockDayCount; i++) {
    toAdd.push(addDays(newBlockStart, i))
  }
  const merged = [...new Set([...periodDays, ...toAdd])].sort()
  const ranges = periodRangesFromDays(merged)
  const months = new Set(toAdd.map((d) => d.slice(0, 7)))
  for (const ym of months) {
    if (rangesOverlappingCalendarMonth(ranges, ym).length > 1) {
      return true
    }
  }
  return false
}

/** 從舊版經期標記推得週期起點（含異常長段的自動切分） */
export function cycleAnchorsFromPeriodDays(periodDays: string[]): string[] {
  const sorted = [...new Set(periodDays)].sort()
  if (sorted.length === 0) return []

  const anchors = new Set<string>()

  for (const iso of sorted) {
    if (!sorted.includes(addDays(iso, -1))) anchors.add(iso)
  }

  for (const r of periodRangesFromDays(periodDays)) {
    const span = diffDays(r.start, r.end) + 1
    if (span > 14) {
      let cur = addDays(r.start, 28)
      while (cur <= r.end) {
        anchors.add(cur)
        cur = addDays(cur, 28)
      }
    }
  }

  return [...anchors].sort()
}

function lastCycleAnchorAtOrBefore(
  anchors: string[],
  iso: string,
): string | null {
  const past = anchors.filter((a) => a <= iso)
  return past.length > 0 ? past[past.length - 1] : null
}

/** 該日在目前週期中的天數；無起點則 null */
export function cycleDayNumberForDate(
  iso: string,
  cycleAnchors: string[],
  avgCycleDays: number,
): number | null {
  const anchor = lastCycleAnchorAtOrBefore(cycleAnchors, iso)
  if (!anchor) return null
  const cycleStart = effectiveCycleStart(anchor, iso, avgCycleDays)
  return diffDays(cycleStart, iso) + 1
}

/**
 * 依平均週期往後推，找出 asOf 所屬週期的開始日。
 * 推估經期日已過但未手動標記時，會自動視為新週期起點（可連續推進多個週期）。
 */
function effectiveCycleStart(
  lastRecordedStart: string,
  asOf: string,
  avgCycleDays: number,
): string {
  const cycle = Math.max(1, avgCycleDays)
  let start = lastRecordedStart
  while (true) {
    const next = addDays(start, cycle)
    if (next <= asOf) start = next
    else break
  }
  return start
}

/** 推估受孕期（排卵前 5 天至排卵後 1 日，僅供日曆顯示） */
export function fertileWindowIsoDates(
  prediction: CyclePrediction,
): string[] {
  if (!prediction.predictedOvulation) return []
  const ov = prediction.predictedOvulation
  return enumerateInclusive(addDays(ov, -5), addDays(ov, 1))
}

/** 從 nextPeriodStart 開始，往後推估多個經期區塊（預設 12 次） */
export function projectedPeriodRanges(
  prediction: CyclePrediction,
  count = 12,
): PeriodRange[] {
  if (!prediction.nextPeriodStart) return []
  const ranges: PeriodRange[] = []
  let start = prediction.nextPeriodStart
  const span = Math.max(1, prediction.avgPeriodDays)
  const cycle = Math.max(1, prediction.avgCycleDays)
  for (let i = 0; i < count; i++) {
    const end = addDays(start, span - 1)
    ranges.push({ start, end })
    start = addDays(start, cycle)
  }
  return ranges
}

/** 往後推估多個排卵日（與 projectedPeriodRanges 對齊） */
export function projectedOvulationDates(
  prediction: CyclePrediction,
  count = 12,
): string[] {
  const periods = projectedPeriodRanges(prediction, count)
  return periods.map((p) => addDays(p.start, -14))
}

/** 往後推估多個排卵期（排卵前 5 天至排卵後 1 天） */
export function projectedFertileWindowDates(
  prediction: CyclePrediction,
  count = 12,
): string[] {
  const ovs = projectedOvulationDates(prediction, count)
  const out = new Set<string>()
  for (const ov of ovs) {
    const window = enumerateInclusive(addDays(ov, -5), addDays(ov, 1))
    for (const d of window) out.add(d)
  }
  return [...out]
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
  cycleAnchors: string[]
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
  const cycleAnchor = lastCycleAnchorAtOrBefore(input.cycleAnchors, asOf)

  const onPeriod = ranges.some((r) => asOf >= r.start && asOf <= r.end)

  let nextPeriodStart: string | null = null
  let predictedOvulation: string | null = null
  let cycleDay: number | null = null

  if (cycleAnchor) {
    const effectiveStart = effectiveCycleStart(
      cycleAnchor,
      asOf,
      avgCycleDays,
    )
    nextPeriodStart = addDays(effectiveStart, avgCycleDays)
    predictedOvulation = addDays(nextPeriodStart, -14)
    cycleDay = diffDays(effectiveStart, asOf) + 1
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

