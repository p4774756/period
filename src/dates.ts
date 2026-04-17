/** 本地日曆日轉 YYYY-MM-DD */
export function toISODateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISODateLocal(new Date())
}

export function parseISOToLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  const d = parseISOToLocal(iso)
  d.setDate(d.getDate() + days)
  return toISODateLocal(d)
}

/** 含首尾；若 a > b 則自動對調 */
export function enumerateInclusive(a: string, b: string): string[] {
  const [start, end] = a <= b ? [a, b] : [b, a]
  const out: string[] = []
  let cur = start
  let guard = 0
  while (guard++ < 62) {
    out.push(cur)
    if (cur === end) break
    cur = addDays(cur, 1)
  }
  return out
}

/** a 到 b 相差天數（b - a），可為負 */
export function diffDays(a: string, b: string): number {
  const da = parseISOToLocal(a)
  const db = parseISOToLocal(b)
  return Math.round((db.getTime() - da.getTime()) / 86_400_000)
}

export function weekdayLabels(): string[] {
  return ['日', '一', '二', '三', '四', '五', '六']
}

export function formatMonthLabel(year: number, monthIndex0: number): string {
  return `${monthIndex0 + 1}月 ${year}`
}

/** 顯示用：4月17日 */
export function formatChineseDay(iso: string): string {
  const d = parseISOToLocal(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** ym 為 YYYY-MM，回該月最後一日（本地日） */
export function lastDayOfCalendarMonth(ym: string): string {
  const [y, mCal] = ym.split('-').map(Number)
  return toISODateLocal(new Date(y, mCal, 0))
}
