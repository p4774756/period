export type UserGoal = 'contraception' | 'trying' | 'tracking'

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
}

export interface AppState {
  settings: AppSettings
  /** 標記為經期的日期 YYYY-MM-DD（本地日） */
  periodDays: string[]
  /** 已顯示過的通知鍵 → 觸發日期 YYYY-MM-DD */
  notificationSent: Record<string, string>
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
}

export function createInitialState(): AppState {
  return {
    settings: { ...defaultSettings },
    periodDays: [],
    notificationSent: {},
  }
}
