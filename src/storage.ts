import { createInitialState, defaultSettings, type AppState } from './types'

const STORAGE_KEY = 'period-tracker-v1'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function parseState(raw: unknown): AppState {
  const base = createInitialState()
  if (!isRecord(raw)) return base

  const settingsIn = raw.settings
  if (!isRecord(settingsIn)) {
    return {
      ...base,
      periodDays: parsePeriodDays(raw.periodDays),
      dayNotes: parseDayNotes(raw.dayNotes),
    }
  }

  const settings = {
    ...defaultSettings,
    ...settingsIn,
  } as AppState['settings']

  const periodDays = parsePeriodDays(raw.periodDays)
  const notificationSent = parseDedupe(raw.notificationSent)
  const dayNotes = parseDayNotes(raw.dayNotes)

  return { settings, periodDays, notificationSent, dayNotes }
}

function parseDayNotes(v: unknown): Record<string, string> {
  if (!isRecord(v)) return {}
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(v)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof val === 'string') {
      out[k] = val
    }
  }
  return out
}

function parsePeriodDays(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x))
}

function parseDedupe(v: unknown): Record<string, string> {
  if (!isRecord(v)) return {}
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === 'string') out[k] = val
  }
  return out
}

export function loadState(): AppState {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (!s) return createInitialState()
    return parseState(JSON.parse(s) as unknown)
  } catch {
    return createInitialState()
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* 私密模式或容量滿 */
  }
}

export function exportStateJson(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

export function importStateJson(text: string): AppState | null {
  try {
    return parseState(JSON.parse(text) as unknown)
  } catch {
    return null
  }
}
