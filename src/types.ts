export type UserGoal = 'contraception' | 'trying' | 'tracking'

/** 日曆每週起始列 */
export type WeekStart = 'monday' | 'sunday'

export interface AppSettings {
  goal: UserGoal
  defaultCycleDays: number
  defaultPeriodDays: number
  notifyPeriod: boolean
  notifyOvulation: boolean
  periodAdvanceDays: number
  ovulationAdvanceDays: number
  reminderHour: number
  reminderMinute: number
  weekStartsOn: WeekStart
  /** 日曆上是否顯示（可各自關閉） */
  calendarShowPeriod: boolean
  calendarShowCycleDay: boolean
  calendarShowOvulation: boolean
  calendarShowFertileWindow: boolean
  calendarShowPredictPeriodStart: boolean
}

export interface AppState {
  settings: AppSettings
  /** 標記為經期的日期 YYYY-MM-DD（本地日） */
  periodDays: string[]
  /** 已顯示過的通知鍵 → 觸發日期 YYYY-MM-DD */
  notificationSent: Record<string, string>
  /** 某日備註（選填），長按「記錄」編輯 */
  dayNotes: Record<string, string>
}

export const defaultSettings: AppSettings = {
  goal: 'tracking',
  defaultCycleDays: 28,
  defaultPeriodDays: 5,
  notifyPeriod: false,
  notifyOvulation: false,
  periodAdvanceDays: 2,
  ovulationAdvanceDays: 2,
  reminderHour: 9,
  reminderMinute: 0,
  weekStartsOn: 'monday',
  calendarShowPeriod: true,
  calendarShowCycleDay: true,
  calendarShowOvulation: true,
  calendarShowFertileWindow: true,
  calendarShowPredictPeriodStart: true,
}

export function createInitialState(): AppState {
  return {
    settings: { ...defaultSettings },
    periodDays: [],
    notificationSent: {},
    dayNotes: {},
  }
}
