import { useRef, useState } from 'react'
import { disclaimerParagraphs, goalLabel } from '../copy'
import { exportStateJson, importStateJson } from '../storage'
import { defaultSettings, type AppState } from '../types'

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
  const appVersion = __APP_VERSION__

  const s = state.settings

  function patchSettings(partial: Partial<typeof s>) {
    onChange({
      ...state,
      settings: { ...s, ...partial },
    })
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
