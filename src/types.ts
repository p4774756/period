export type UserGoal = 'contraception' | 'trying' | 'tracking'
export type MascotAnimal = 'rabbit' | 'cat' | 'bear' | 'dog' | 'panda' | 'fox'

export const MASCOT_LABEL: Record<MascotAnimal, string> = {
  rabbit: '兔子',
  cat: '貓咪',
  bear: '熊熊',
  dog: '狗狗',
  panda: '貓熊',
  fox: '狐狸',
}
export type ThemeName = 'sakura' | 'mint' | 'sunset' | 'night'

/** 日曆每週起始列 */
export type WeekStart = 'monday' | 'sunday'

export interface AppSettings {
  goal: UserGoal
  defaultCycleDays: number
  defaultPeriodDays: number
  weekStartsOn: WeekStart
  /** 日曆上是否顯示（可各自關閉） */
  calendarShowPeriod: boolean
  calendarShowCycleDay: boolean
  calendarShowOvulation: boolean
  calendarShowFertileWindow: boolean
  calendarShowPredictPeriodStart: boolean
  mascotAnimal: MascotAnimal
  themeName: ThemeName
}

export interface AppState {
  settings: AppSettings
  /** 標記為經期的日期 YYYY-MM-DD（本地日） */
  periodDays: string[]
  /** 使用者點選的經期「開始日」；週期天數以此為準，不受連續標記合併影響 */
  cycleAnchors: string[]
  /** 某日備註（選填），長按「記錄」編輯 */
  dayNotes: Record<string, string>
}

export const defaultSettings: AppSettings = {
  goal: 'tracking',
  defaultCycleDays: 28,
  defaultPeriodDays: 5,
  weekStartsOn: 'monday',
  calendarShowPeriod: true,
  calendarShowCycleDay: true,
  calendarShowOvulation: true,
  calendarShowFertileWindow: true,
  calendarShowPredictPeriodStart: true,
  mascotAnimal: 'rabbit',
  themeName: 'sakura',
}

export function createInitialState(): AppState {
  return {
    settings: { ...defaultSettings },
    periodDays: [],
    cycleAnchors: [],
    dayNotes: {},
  }
}
