import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { onSchedule } from 'firebase-functions/v2/scheduler'
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
 * 每小時掃描一次 reminders 集合，將「觸發時間 <= now」的提醒透過 FCM 推送，
 * 推送完將該欄位清空（避免重發）。前端在每次預測或設定變動時會重新覆寫文件，
 * 屆時又會產生下一次的觸發時間。
 *
 * 提醒時間與實際跳出通知之間最多可能延遲約一個小時（取決於排程與當日整點對齊）。
 * 若需要更準時，可把 schedule 改回 every 5 minutes。
 *
 * 小規模專案（單一使用者）足夠便宜；若日後使用者增加，建議改為依時間排序的查詢
 * + 索引，並把 schedule 改為 onCall 觸發。
 */
export const scheduledSendReminders = onSchedule(
  {
    schedule: 'every 1 hours',
    timeZone: 'Etc/UTC',
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
