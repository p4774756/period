import {
  isAtOrPastReminderTime,
  isBeforeEventEnd,
  reminderFireDate,
  type CyclePrediction,
} from './cycleMath'
import type { AppState } from './types'

function shouldNotifyWindow(
  now: Date,
  eventISO: string,
  advanceDays: number,
  hour: number,
  minute: number,
): boolean {
  const reminderDay = reminderFireDate(eventISO, advanceDays)
  if (!isAtOrPastReminderTime(now, reminderDay, hour, minute)) return false
  if (!isBeforeEventEnd(now, eventISO)) return false
  return true
}

export function notificationSupported(): boolean {
  return typeof Notification !== 'undefined'
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationSupported()) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export interface NotificationCheckResult {
  notificationSent: AppState['notificationSent']
}

/** 在頁面開啟時檢查是否應顯示經期／排卵提醒（純前端最佳努力） */
export function checkAndNotify(
  state: AppState,
  prediction: CyclePrediction,
  now: Date = new Date(),
): NotificationCheckResult {
  if (!notificationSupported() || Notification.permission !== 'granted') {
    return { notificationSent: state.notificationSent }
  }

  const s = state.settings
  let next = state.notificationSent
  let changed = false

  const touch = (key: string) => {
    if (next[key]) return
    if (!changed) {
      next = { ...state.notificationSent }
      changed = true
    }
    next[key] = '1'
  }

  if (
    s.notifyPeriod &&
    prediction.nextPeriodStart &&
    shouldNotifyWindow(
      now,
      prediction.nextPeriodStart,
      s.periodAdvanceDays,
      s.reminderHour,
      s.reminderMinute,
    )
  ) {
    const key = `period:${prediction.nextPeriodStart}`
    if (!next[key]) {
      new Notification('經期提醒', {
        body: `預估下次經期開始：${prediction.nextPeriodStart}。此為推估，實際狀況可能不同。`,
        lang: 'zh-Hant',
      })
      touch(key)
    }
  }

  if (
    s.notifyOvulation &&
    prediction.predictedOvulation &&
    shouldNotifyWindow(
      now,
      prediction.predictedOvulation,
      s.ovulationAdvanceDays,
      s.reminderHour,
      s.reminderMinute,
    )
  ) {
    const key = `ovulation:${prediction.predictedOvulation}`
    if (!next[key]) {
      new Notification('排卵日提醒', {
        body: `預估排卵日：${prediction.predictedOvulation}。此為推估，非醫療診斷。`,
        lang: 'zh-Hant',
      })
      touch(key)
    }
  }

  return { notificationSent: changed ? next : state.notificationSent }
}
