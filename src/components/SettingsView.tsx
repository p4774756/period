import { useRef, useState } from 'react'
import { disclaimerParagraphs, goalLabel } from '../copy'
import { exportStateJson, importStateJson } from '../storage'
import { defaultSettings, type AppState } from '../types'
import {
  disableCloudPush,
  enableCloudPush,
  notificationSupported,
  requestNotificationPermission,
  sendCloudTestNotification,
  sendTestNotification,
} from '../notifications'
import { computePrediction } from '../cycleMath'

export function SettingsView({
  state,
  onChange,
  onBack,
}: {
  state: AppState
  onChange: (next: AppState) => void
  onBack: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null)
  const [cloudBusy, setCloudBusy] = useState(false)
  const appVersion = __APP_VERSION__

  const s = state.settings

  function patchSettings(partial: Partial<typeof s>) {
    onChange({
      ...state,
      settings: { ...s, ...partial },
    })
  }

  async function onEnableNotifications() {
    const p = await requestNotificationPermission()
    if (p !== 'granted') {
      setNotifyMsg('通知權限未開啟：請在瀏覽器設定中允許此網站通知。')
      return
    }
    patchSettings({ notifyPeriod: true, notifyOvulation: true })
    setNotifyMsg('已允許通知，並已開啟經期與排卵提醒開關（可自行再調整）。')
  }

  async function onToggleCloudPush(checked: boolean) {
    if (cloudBusy) return
    setCloudBusy(true)
    setNotifyMsg(null)
    try {
      if (checked) {
        const prediction = computePrediction({
          periodDays: state.periodDays,
          settings: state.settings,
        })
        const r = await enableCloudPush(state, prediction)
        if (r === 'enabled') {
          patchSettings({ cloudPushEnabled: true })
          setNotifyMsg(
            '已啟用雲端推播。即使分頁關閉、手機鎖屏，到時間都能收到提醒（iOS 需先「加到主畫面」）。',
          )
        } else if (r === 'unsupported') {
          setNotifyMsg(
            '此瀏覽器不支援 Web Push（FCM）。建議使用桌機 Chrome／Edge 或 Android Chrome。',
          )
        } else if (r === 'denied') {
          setNotifyMsg('通知權限已被拒絕：請在瀏覽器網址列旁的權限設定中改為允許。')
        } else if (r === 'dismissed') {
          setNotifyMsg('尚未取得通知權限：請允許通知後再啟用。')
        } else if (r === 'no-token') {
          setNotifyMsg(
            '無法取得推播金鑰：可能是 Service Worker 註冊失敗，或瀏覽器封鎖了 FCM。請重新整理頁面再試。',
          )
        } else {
          setNotifyMsg('啟用失敗，請稍後再試（請確認網路連線正常）。')
        }
      } else {
        await disableCloudPush()
        patchSettings({ cloudPushEnabled: false })
        setNotifyMsg('已關閉雲端推播，並已從伺服器移除此裝置紀錄。')
      }
    } finally {
      setCloudBusy(false)
    }
  }

  async function onTestCloudPush() {
    if (cloudBusy) return
    setCloudBusy(true)
    setNotifyMsg('正在透過 Firebase 發送測試推播…')
    try {
      const r = await sendCloudTestNotification()
      switch (r.result) {
        case 'sent':
          setNotifyMsg(
            '已從伺服器送出測試推播，幾秒內應跳出通知；可關閉此分頁／鎖屏觀察。若沒看到請檢查系統勿擾與瀏覽器網站通知設定。',
          )
          break
        case 'not-enabled':
          setNotifyMsg(r.message || '尚未啟用雲端推播：請先勾選「雲端推播」。')
          break
        case 'no-token':
          setNotifyMsg(
            r.message || '推播金鑰失效：請關閉再重新啟用「雲端推播」。',
          )
          break
        case 'unauthenticated':
          setNotifyMsg('身分驗證失敗，請重新整理頁面後再試。')
          break
        case 'failed':
          setNotifyMsg(`測試推播失敗：${r.message ?? '請稍後再試'}`)
          break
      }
    } finally {
      setCloudBusy(false)
    }
  }

  async function onTestNotification() {
    const r = await sendTestNotification()
    switch (r) {
      case 'sent':
        setNotifyMsg(
          '已送出測試通知。若沒看到：請檢查系統「勿擾／專注模式」、瀏覽器網站通知設定，行動裝置請確認此分頁仍開啟。',
        )
        break
      case 'unsupported':
        setNotifyMsg('此瀏覽器不支援網頁通知。')
        break
      case 'denied':
        setNotifyMsg('通知權限已被拒絕：請在瀏覽器網址列旁的權限設定中改為允許。')
        break
      case 'dismissed':
        setNotifyMsg('尚未取得通知權限：請先按上方「請求通知權限並開啟提醒」。')
        break
      case 'failed':
        setNotifyMsg(
          '此瀏覽器不允許直接彈出通知（常見於部分行動瀏覽器）。請改用桌機 Chrome／Firefox／Edge，或加到主畫面後再試。',
        )
        break
    }
  }

  return (
    <div className="panel settings">
      <header className="today-header">
        <button type="button" className="ghost" onClick={onBack}>
          返回
        </button>
        <h1>設定</h1>
        <span className="spacer" />
      </header>

      <section className="card">
        <h2>使用目的</h2>
        <p className="muted small">
          僅影響文案語氣與提醒重點，計算方式相同。
        </p>
        <div className="segmented">
          {(
            [
              ['contraception', '避孕'],
              ['trying', '備孕'],
              ['tracking', '僅紀錄'],
            ] as const
          ).map(([id, short]) => (
            <button
              key={id}
              type="button"
              className={s.goal === id ? 'seg active' : 'seg'}
              onClick={() => patchSettings({ goal: id })}
            >
              {short}
            </button>
          ))}
        </div>
        <p className="muted small">{goalLabel(s.goal)}</p>
      </section>

      <section className="card">
        <h2>預設週期（無足夠紀錄時）</h2>
        <label className="field">
          <span>預設週期長度（天）</span>
          <input
            type="number"
            min={21}
            max={45}
            value={s.defaultCycleDays}
            onChange={(e) =>
              patchSettings({ defaultCycleDays: Number(e.target.value) })
            }
          />
        </label>
        <label className="field">
          <span>預設經期長度（天）</span>
          <input
            type="number"
            min={2}
            max={14}
            value={s.defaultPeriodDays}
            onChange={(e) =>
              patchSettings({ defaultPeriodDays: Number(e.target.value) })
            }
          />
        </label>
      </section>

      <section className="card">
        <h2>通知</h2>
        <p className="muted small">
          僅提醒「經期」與「排卵日」，不含易孕窗。本機提醒只在分頁開啟時觸發；若想在鎖屏／關分頁時也收到，請啟用下方「雲端推播」。
        </p>
        {!notificationSupported() && (
          <p className="warn">此瀏覽器不支援網頁通知。</p>
        )}
        <button
          type="button"
          className="primary wide"
          onClick={onEnableNotifications}
          disabled={!notificationSupported()}
        >
          請求通知權限並開啟提醒
        </button>
        <button
          type="button"
          className="secondary wide"
          onClick={onTestNotification}
          disabled={!notificationSupported()}
        >
          測試通知（立即送出一則）
        </button>

        <label className="check">
          <input
            type="checkbox"
            checked={s.cloudPushEnabled}
            disabled={cloudBusy || !notificationSupported()}
            onChange={(e) => onToggleCloudPush(e.target.checked)}
          />
          雲端推播（鎖屏／關分頁也能收到）
        </label>
        <p className="muted small">
          僅上傳「下次經期／排卵的觸發時間」與裝置推播金鑰到 Firebase；不上傳歷史紀錄。Android Chrome／桌面瀏覽器皆可；iOS Safari 需先把網頁「加到主畫面」並從圖示開啟。伺服器每天台北時間早上 8 點批次檢查並推送，因此設定的「提醒時間」只決定哪一天會收到，實際送達固定落在早上 8 點前後。
        </p>
        <button
          type="button"
          className="secondary wide"
          onClick={onTestCloudPush}
          disabled={!s.cloudPushEnabled || cloudBusy}
        >
          測試雲端推播（立即從伺服器發送）
        </button>
        {notifyMsg && <p className="muted small">{notifyMsg}</p>}

        <label className="check">
          <input
            type="checkbox"
            checked={s.notifyPeriod}
            onChange={(e) => patchSettings({ notifyPeriod: e.target.checked })}
          />
          經期開始提醒
        </label>
        <label className="field inline">
          <span>提前天數</span>
          <input
            type="number"
            min={0}
            max={14}
            value={s.periodAdvanceDays}
            onChange={(e) =>
              patchSettings({ periodAdvanceDays: Number(e.target.value) })
            }
          />
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={s.notifyOvulation}
            onChange={(e) => patchSettings({ notifyOvulation: e.target.checked })}
          />
          排卵日提醒
        </label>
        <label className="field inline">
          <span>提前天數</span>
          <input
            type="number"
            min={0}
            max={14}
            value={s.ovulationAdvanceDays}
            onChange={(e) =>
              patchSettings({ ovulationAdvanceDays: Number(e.target.value) })
            }
          />
        </label>

        <label className="field">
          <span>提醒時間</span>
          <input
            type="time"
            value={`${String(s.reminderHour).padStart(2, '0')}:${String(s.reminderMinute).padStart(2, '0')}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(':').map(Number)
              patchSettings({ reminderHour: h, reminderMinute: m })
            }}
          />
        </label>
      </section>

      <section className="card">
        <h2>資料</h2>
        <button
          type="button"
          className="secondary wide"
          onClick={() => {
            const blob = new Blob([exportStateJson(state)], {
              type: 'application/json',
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `period-backup-${Date.now()}.json`
            a.click()
            URL.revokeObjectURL(url)
          }}
        >
          匯出備份（JSON）
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            const text = await f.text()
            const next = importStateJson(text)
            if (!next) {
              setImportMsg('匯入失敗：檔案格式不正確。')
              return
            }
            onChange(next)
            setImportMsg('匯入成功。')
          }}
        />
        <button
          type="button"
          className="secondary wide"
          onClick={() => fileRef.current?.click()}
        >
          匯入備份
        </button>
        <button
          type="button"
          className="danger wide"
          onClick={() => {
            if (
              confirm(
                '確定清除所有本地紀錄？此動作無法復原（除非已匯出備份）。',
              )
            ) {
              onChange({
                settings: { ...defaultSettings },
                periodDays: [],
                notificationSent: {},
                dayNotes: {},
              })
              setImportMsg('已清除本地紀錄。')
            }
          }}
        >
          清除本地紀錄
        </button>
        {importMsg && <p className="muted small">{importMsg}</p>}
      </section>

      <section className="card disclaimer">
        <h2>免責聲明</h2>
        {disclaimerParagraphs().map((p, i) => (
          <p key={i} className="muted small">
            {p}
          </p>
        ))}
        <p className="muted small settings-version">版本 v{appVersion}</p>
      </section>
    </div>
  )
}
