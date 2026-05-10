import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'

initializeApp()

interface ReminderDoc {
  fcmToken?: string
  tz?: string
  periodFireAt?: Timestamp | null
  ovulationFireAt?: Timestamp | null
  periodTargetDate?: string
  ovulationTargetDate?: string
}

interface PendingMessage {
  uid: string
  token: string
  kind: 'period' | 'ovulation'
  title: string
  body: string
}

/**
 * 每天台北時間 08:00 掃描一次 reminders，把「觸發時間 <= 現在」的提醒透過 FCM 推送，
 * 推送完將該欄位清空（避免重發）。前端在每次預測或設定變動時會重新覆寫文件，
 * 屆時又會產生下一次的觸發時間。
 *
 * 取捨：使用者在設定裡指定的「提醒時間」其實只用來判斷「哪一天該發」，實際送達時間
 * 一律落在台北早上 8 點左右。對「經期前 N 天提醒」這類用途，每日批次已足夠。
 * 若需要更貼近指定時刻，可改為 every 1 hours / every 15 minutes。
 */
export const scheduledSendReminders = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'Asia/Taipei',
    region: 'asia-east1',
    memory: '256MiB',
  },
  async () => {
    const db = getFirestore()
    const now = Timestamp.now()

    const snap = await db.collection('reminders').get()
    if (snap.empty) {
      logger.info('reminders 集合為空，略過。')
      return
    }

    const pending: PendingMessage[] = []
    const updates: Promise<unknown>[] = []

    for (const docSnap of snap.docs) {
      const data = docSnap.data() as ReminderDoc
      const token = data.fcmToken
      if (!token) continue

      const patch: Record<string, unknown> = {}

      if (data.periodFireAt && data.periodFireAt.toMillis() <= now.toMillis()) {
        pending.push({
          uid: docSnap.id,
          token,
          kind: 'period',
          title: '經期提醒',
          body: data.periodTargetDate
            ? `預估下次經期開始：${data.periodTargetDate}。此為推估，實際可能不同。`
            : '預估下次經期即將開始。',
        })
        patch.periodFireAt = null
      }

      if (
        data.ovulationFireAt &&
        data.ovulationFireAt.toMillis() <= now.toMillis()
      ) {
        pending.push({
          uid: docSnap.id,
          token,
          kind: 'ovulation',
          title: '排卵日提醒',
          body: data.ovulationTargetDate
            ? `預估排卵日：${data.ovulationTargetDate}。此為推估，非醫療診斷。`
            : '預估排卵日即將到來。',
        })
        patch.ovulationFireAt = null
      }

      if (Object.keys(patch).length > 0) {
        updates.push(docSnap.ref.update(patch))
      }
    }

    if (pending.length === 0) {
      logger.info(`掃描 ${snap.size} 筆 reminders，沒有到期項目。`)
      return
    }

    // 用 data-only 訊息：交由 Service Worker 的 onBackgroundMessage 自行決定外觀，
    // 才能依 kind 顯示不同 tag、避免被瀏覽器替換成預設標題。
    const messaging = getMessaging()
    const sendResults = await Promise.allSettled(
      pending.map((p) =>
        messaging.send({
          token: p.token,
          // 不送 url；SW 會以 self.registration.scope 為預設目標，
          // 避免在子路徑部署（例如 GitHub Pages /period/）時打開錯誤位置。
          data: {
            title: p.title,
            body: p.body,
            tag: p.kind,
          },
        }),
      ),
    )

    let success = 0
    const tokensToCleanup = new Set<string>()
    sendResults.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        success++
      } else {
        const err = r.reason as { code?: string; message?: string }
        const code = err?.code || ''
        logger.warn(
          `FCM 發送失敗 uid=${pending[i].uid} kind=${pending[i].kind} code=${code} msg=${err?.message}`,
        )
        // token 失效時刪除整份文件，避免後續永遠失敗。
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          tokensToCleanup.add(pending[i].uid)
        }
      }
    })

    for (const uid of tokensToCleanup) {
      updates.push(db.collection('reminders').doc(uid).delete())
    }

    await Promise.allSettled(updates)
    logger.info(
      `處理完成：嘗試 ${pending.length} 則、成功 ${success} 則、清理失效 token ${tokensToCleanup.size} 份。`,
    )
  },
)

/**
 * 立即送出一則「測試雲端推播」通知到呼叫者目前的 FCM token。
 * 用來驗證整條鏈路（前端授權 → SW 註冊 → token 寫入 Firestore →
 * Cloud Function 取得 token → FCM 推送 → SW onBackgroundMessage 顯示通知）
 * 都正確運作，不必等到一小時排程。
 */
export const sendTestCloudPush = onCall(
  { region: 'asia-east1', memory: '256MiB' },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', '需要先登入（匿名身分）才能測試。')
    }

    const db = getFirestore()
    const docRef = db.collection('reminders').doc(uid)
    const snap = await docRef.get()
    if (!snap.exists) {
      throw new HttpsError(
        'failed-precondition',
        '尚未啟用雲端推播：請先在設定裡勾選「雲端推播」。',
      )
    }
    const data = snap.data() as ReminderDoc
    const token = data.fcmToken
    if (!token) {
      throw new HttpsError(
        'failed-precondition',
        '找不到此裝置的推播金鑰，請關閉再重新啟用「雲端推播」。',
      )
    }

    try {
      await getMessaging().send({
        token,
        data: {
          title: '雲端推播測試',
          body: '若你看到這則通知，表示 Firebase 雲端推播鏈路完全正常 🎉',
          tag: 'test',
        },
      })
      return { ok: true }
    } catch (err) {
      const e = err as { code?: string; message?: string }
      logger.warn(
        `測試推播失敗 uid=${uid} code=${e?.code} msg=${e?.message}`,
      )
      if (
        e?.code === 'messaging/registration-token-not-registered' ||
        e?.code === 'messaging/invalid-registration-token'
      ) {
        await docRef.delete().catch(() => {})
        throw new HttpsError(
          'failed-precondition',
          '推播金鑰已失效（瀏覽器可能清過資料）。請關閉再重新啟用「雲端推播」。',
        )
      }
      throw new HttpsError('internal', `FCM 發送失敗：${e?.message ?? '未知錯誤'}`)
    }
  },
)
