import { useRef, useState } from 'react'
import { disclaimerParagraphs, goalLabel } from '../copy'
import { exportStateJson, importStateJson } from '../storage'
import { defaultSettings, type AppState } from '../types'
import { notificationSupported, requestNotificationPermission } from '../notifications'

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
      setImportMsg('通知權限未開啟：請在瀏覽器設定中允許此網站通知。')
      return
    }
    patchSettings({ notifyPeriod: true, notifyOvulation: true })
    setImportMsg('已允許通知，並已開啟經期與排卵提醒開關（可自行再調整）。')
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
        <h2>通知（純前端最佳努力）</h2>
        <p className="muted small">
          僅提醒「經期」與「排卵日」，不含易孕窗。需開啟分頁或定期開啟網頁，推播才可能觸發。
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
      </section>
    </div>
  )
}
