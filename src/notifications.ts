import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { deleteToken, getToken, onMessage } from 'firebase/messaging'
import {
  isAtOrPastReminderTime,
  isBeforeEventEnd,
  reminderFireDate,
  type CyclePrediction,
} from './cycleMath'
import { addDays, parseISOToLocal } from './dates'
import {
  ensureAnonymousUser,
  FCM_VAPID_KEY,
  getFirebaseFirestore,
  getFirebaseFunctions,
  getFirebaseMessaging,
} from './firebase'
import type { AppSettings, AppState } from './types'

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

export type TestNotificationResult =
  | 'sent'
  | 'unsupported'
  | 'denied'
  | 'dismissed'
  | 'failed'

/**
 * 立即送出一則測試通知；若尚未授權，先嘗試詢問權限。
 * 用來驗證瀏覽器確實能彈出通知（部分行動瀏覽器即使授權仍不允許）。
 */
export async function sendTestNotification(): Promise<TestNotificationResult> {
  if (!notificationSupported()) return 'unsupported'
  let permission = Notification.permission
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission()
    } catch {
      return 'failed'
    }
  }
  if (permission !== 'granted') {
    return permission === 'denied' ? 'denied' : 'dismissed'
  }
  const ok = safeCreateNotification('測試通知', {
    body: '若你看到這則通知，表示瀏覽器可正常推播提醒。',
    lang: 'zh-Hant',
  })
  return ok ? 'sent' : 'failed'
}

export interface NotificationCheckResult {
  notificationSent: AppState['notificationSent']
}

function safeCreateNotification(title: string, options: NotificationOptions): boolean {
  try {
    new Notification(title, options)
    return true
  } catch {
    // 某些行動瀏覽器即使存在 Notification 物件，仍不允許直接建構通知。
    return false
  }
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
      const created = safeCreateNotification('經期提醒', {
        body: `預估下次經期開始：${prediction.nextPeriodStart}。此為推估，實際狀況可能不同。`,
        lang: 'zh-Hant',
      })
      if (created) touch(key)
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
      const created = safeCreateNotification('排卵日提醒', {
        body: `預估排卵日：${prediction.predictedOvulation}。此為推估，非醫療診斷。`,
        lang: 'zh-Hant',
      })
      if (created) touch(key)
    }
  }

  return { notificationSent: changed ? next : state.notificationSent }
}

// ---------------------------------------------------------------------------
// 雲端推播（FCM Web Push + Cloud Functions 排程）
//
// 設計重點：
// - App 在本機完成所有預測；只把「下一次觸發時間」與 FCM token 上傳。
// - 不上傳任何歷史經期紀錄，亦不上傳設定細節。
// - Cloud Function 排程到時直接以 FCM 推送，前端 Service Worker 顯示通知，
//   因此使用者鎖屏／關分頁也能收到。
// - 使用者關閉開關時會刪除 FCM token 與 Firestore 文件，徹底結束雲端足跡。
// ---------------------------------------------------------------------------

export type CloudPushEnableResult =
  | 'enabled'
  | 'unsupported'
  | 'denied'
  | 'dismissed'
  | 'no-token'
  | 'failed'

interface ReminderDocPayload {
  fcmToken: string
  tz: string
  periodFireAt: Timestamp | null
  ovulationFireAt: Timestamp | null
  periodTargetDate: string
  ovulationTargetDate: string
  updatedAt: ReturnType<typeof serverTimestamp>
}

function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Taipei'
  } catch {
    return 'Asia/Taipei'
  }
}

/** 算出「事件日提前 advanceDays 天、在使用者本機 hour:minute」對應的 Date。 */
function computeFireDate(
  eventISO: string | null,
  advanceDays: number,
  hour: number,
  minute: number,
): Date | null {
  if (!eventISO) return null
  const reminderDay = addDays(eventISO, -advanceDays)
  const d = parseISOToLocal(reminderDay)
  d.setHours(hour, minute, 0, 0)
  return d
}

function buildReminderPayload(
  fcmToken: string,
  settings: AppSettings,
  prediction: CyclePrediction,
  now: Date = new Date(),
): ReminderDocPayload {
  const periodFire = settings.notifyPeriod
    ? computeFireDate(
        prediction.nextPeriodStart,
        settings.periodAdvanceDays,
        settings.reminderHour,
        settings.reminderMinute,
      )
    : null
  const ovuFire = settings.notifyOvulation
    ? computeFireDate(
        prediction.predictedOvulation,
        settings.ovulationAdvanceDays,
        settings.reminderHour,
        settings.reminderMinute,
      )
    : null

  // 已過時間就不再上傳，避免 Cloud Function 立刻又推一次過期通知。
  const periodFireAt = periodFire && periodFire.getTime() > now.getTime()
    ? Timestamp.fromDate(periodFire)
    : null
  const ovulationFireAt = ovuFire && ovuFire.getTime() > now.getTime()
    ? Timestamp.fromDate(ovuFire)
    : null

  return {
    fcmToken,
    tz: localTimeZone(),
    periodFireAt,
    ovulationFireAt,
    periodTargetDate: prediction.nextPeriodStart ?? '',
    ovulationTargetDate: prediction.predictedOvulation ?? '',
    updatedAt: serverTimestamp(),
  }
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }
  // 部署在 GitHub Pages 的子路徑（例如 /period/）時，SW 必須跟著 base 走，
  // 否則會 404。dev 模式下 BASE_URL 是 '/'，build 後是 vite.config.ts 設的值。
  const base = import.meta.env.BASE_URL || '/'
  const swPath = `${base}firebase-messaging-sw.js`
  try {
    return await navigator.serviceWorker.register(swPath, { scope: base })
  } catch {
    return null
  }
}

async function obtainFcmToken(): Promise<string | null> {
  const messaging = await getFirebaseMessaging()
  if (!messaging) return null
  const reg = await getServiceWorkerRegistration()
  if (!reg) return null
  try {
    const token = await getToken(messaging, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: reg,
    })
    if (token) ensureForegroundMessageListener()
    return token || null
  } catch {
    return null
  }
}

let foregroundListenerInstalled = false

/**
 * 註冊前景訊息監聽器：當分頁正在前景時，FCM 不會走 Service Worker 的
 * onBackgroundMessage，而是走這裡。
 *
 * 重要：行動瀏覽器（Android Chrome/Edge）禁止頁面直接 new Notification()，
 * 必須透過 ServiceWorkerRegistration.showNotification()。所以這裡刻意走
 * SW，桌機與行動裝置都能正常顯示。
 */
function ensureForegroundMessageListener(): void {
  if (foregroundListenerInstalled) return
  foregroundListenerInstalled = true
  void getFirebaseMessaging().then((messaging) => {
    if (!messaging) return
    onMessage(messaging, async (payload) => {
      if (
        typeof Notification === 'undefined' ||
        Notification.permission !== 'granted'
      ) {
        return
      }
      const n = payload.notification || {}
      const data = payload.data || {}
      const title = n.title || data.title || '提醒'
      const body = n.body || data.body || ''
      const tag = data.tag || 'period-tracker'

      try {
        const reg =
          (await navigator.serviceWorker?.getRegistration()) ||
          (await navigator.serviceWorker?.ready)
        if (reg) {
          await reg.showNotification(title, { body, lang: 'zh-Hant', tag })
          return
        }
      } catch {
        /* 取不到 registration，下面 fallback */
      }
      try {
        new Notification(title, { body, lang: 'zh-Hant', tag })
      } catch {
        /* 行動瀏覽器禁止；已盡力 */
      }
    })
  })
}

/**
 * 啟用雲端推播：請求權限 → 取得 FCM token → 匿名登入 → 寫入 reminders/{uid}。
 * 全程任一步失敗會回傳對應狀態，由 UI 顯示提示。
 */
export async function enableCloudPush(
  state: AppState,
  prediction: CyclePrediction,
): Promise<CloudPushEnableResult> {
  if (!notificationSupported()) return 'unsupported'

  let permission = Notification.permission
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission()
    } catch {
      return 'failed'
    }
  }
  if (permission !== 'granted') {
    return permission === 'denied' ? 'denied' : 'dismissed'
  }

  let user
  try {
    user = await ensureAnonymousUser()
  } catch {
    return 'failed'
  }

  const token = await obtainFcmToken()
  if (!token) return 'no-token'

  const payload = buildReminderPayload(token, state.settings, prediction)
  try {
    await setDoc(
      doc(getFirebaseFirestore(), 'reminders', user.uid),
      payload,
      { merge: false },
    )
  } catch {
    return 'failed'
  }
  return 'enabled'
}

/** 關閉雲端推播：刪除 Firestore 文件與 FCM token。 */
export async function disableCloudPush(): Promise<void> {
  try {
    const user = await ensureAnonymousUser()
    await deleteDoc(doc(getFirebaseFirestore(), 'reminders', user.uid)).catch(() => {})
  } catch {
    /* 忽略：已沒有有效身分 */
  }
  try {
    const messaging = await getFirebaseMessaging()
    if (messaging) await deleteToken(messaging).catch(() => {})
  } catch {
    /* 忽略 */
  }
}

/**
 * 預測或設定變動時呼叫。已啟用雲端推播時，重新計算下一次觸發時間並覆寫 Firestore。
 * 若 token 失效或權限取消，會靜默結束（不要影響 App 主流程）。
 */
export async function syncReminderToCloud(
  state: AppState,
  prediction: CyclePrediction,
): Promise<void> {
  if (!state.settings.cloudPushEnabled) return
  if (!notificationSupported()) return
  if (Notification.permission !== 'granted') return

  let user
  try {
    user = await ensureAnonymousUser()
  } catch {
    return
  }
  const token = await obtainFcmToken()
  if (!token) return

  const payload = buildReminderPayload(token, state.settings, prediction)
  try {
    await setDoc(
      doc(getFirebaseFirestore(), 'reminders', user.uid),
      payload,
      { merge: false },
    )
  } catch {
    /* 靜默忽略 */
  }
}

export type CloudTestResult =
  | 'sent'
  | 'not-enabled'
  | 'unauthenticated'
  | 'no-token'
  | 'failed'

/**
 * 呼叫 Cloud Function 立即送一則測試推播到目前裝置的 FCM token，
 * 用來驗證雲端推播鏈路（不必等到一小時排程）。
 */
export async function sendCloudTestNotification(): Promise<{
  result: CloudTestResult
  message?: string
}> {
  try {
    await ensureAnonymousUser()
  } catch {
    return { result: 'unauthenticated' }
  }
  try {
    const callable = httpsCallable<unknown, { ok: boolean }>(
      getFirebaseFunctions(),
      'sendTestCloudPush',
    )
    await callable()
    return { result: 'sent' }
  } catch (err) {
    const e = err as { code?: string; message?: string }
    const code = e?.code || ''
    if (code === 'functions/failed-precondition') {
      // 後端訊息已具體說明（未啟用 / token 失效）
      const msg = e?.message || ''
      if (msg.includes('金鑰')) return { result: 'no-token', message: msg }
      return { result: 'not-enabled', message: msg }
    }
    if (code === 'functions/unauthenticated') {
      return { result: 'unauthenticated' }
    }
    return { result: 'failed', message: e?.message }
  }
}
