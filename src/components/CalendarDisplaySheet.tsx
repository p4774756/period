import {
  CalendarDays,
  Droplet,
  Droplets,
  Flower2,
  Settings2,
  Square,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppSettings, WeekStart } from '../types'

/** 圖示來源：Lucide（https://lucide.dev，ISC License） */

function ToggleRow({
  preview,
  label,
  checked,
  onChange,
}: {
  preview: ReactNode
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="cal-toggle-row">
      <span className="cal-toggle-preview" aria-hidden>
        {preview}
      </span>
      <span className="cal-toggle-label">{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="cal-toggle-switch"
      />
    </label>
  )
}

export function CalendarDisplaySheet({
  open,
  settings,
  onClose,
  onPatch,
}: {
  open: boolean
  settings: AppSettings
  onClose: () => void
  onPatch: (p: Partial<AppSettings>) => void
}) {
  if (!open) return null

  return (
    <div
      className="cal-sheet-backdrop cal-display-sheet-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="cal-display-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cal-display-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cal-display-sheet-handle" aria-hidden />

        <h2 id="cal-display-title" className="cal-display-sheet-title">
          <Settings2 size={22} strokeWidth={2} className="cal-display-title-ic" />
          日曆設定
        </h2>

        <section className="cal-display-section">
          <h3 className="cal-display-subtitle">每週的第一天</h3>
          <div className="segmented cal-display-seg" role="group">
            <button
              type="button"
              className={
                settings.weekStartsOn === 'monday' ? 'seg active' : 'seg'
              }
              onClick={() => onPatch({ weekStartsOn: 'monday' as WeekStart })}
            >
              星期一
            </button>
            <button
              type="button"
              className={
                settings.weekStartsOn === 'sunday' ? 'seg active' : 'seg'
              }
              onClick={() => onPatch({ weekStartsOn: 'sunday' as WeekStart })}
            >
              星期日
            </button>
          </div>
        </section>

        <section className="cal-display-section">
          <h3 className="cal-display-subtitle">顯示在日曆上的圖示</h3>
          <p className="muted tiny cal-display-note">
            受孕期為推估區間（排卵前後），與通知無關，僅供參考。
          </p>

          <div className="cal-toggle-list">
            <ToggleRow
              label="週期天數"
              checked={settings.calendarShowCycleDay}
              onChange={(v) => onPatch({ calendarShowCycleDay: v })}
              preview={
                <span className="cal-preview-cell">
                  <span className="cal-preview-num">1</span>
                  <CalendarDays
                    size={13}
                    strokeWidth={2}
                    className="cal-preview-ic cal-preview-ic-br"
                  />
                </span>
              }
            />
            <ToggleRow
              label="排卵日"
              checked={settings.calendarShowOvulation}
              onChange={(v) => onPatch({ calendarShowOvulation: v })}
              preview={
                <span className="cal-preview-cell">
                  <span className="cal-preview-num">1</span>
                  <Droplet
                    size={13}
                    strokeWidth={2}
                    className="cal-preview-ic cal-preview-ic-bl cal-preview-drop"
                  />
                </span>
              }
            />
            <ToggleRow
              label="受孕期"
              checked={settings.calendarShowFertileWindow}
              onChange={(v) => onPatch({ calendarShowFertileWindow: v })}
              preview={
                <span className="cal-preview-cell">
                  <span className="cal-preview-num">1</span>
                  <Flower2
                    size={13}
                    strokeWidth={2}
                    className="cal-preview-ic cal-preview-ic-bl cal-preview-flower"
                  />
                </span>
              }
            />
            <ToggleRow
              label="生理期"
              checked={settings.calendarShowPeriod}
              onChange={(v) => onPatch({ calendarShowPeriod: v })}
              preview={
                <span className="cal-preview-cell cal-preview-period">
                  <span className="cal-preview-num">1</span>
                  <Droplets
                    size={12}
                    strokeWidth={2}
                    className="cal-preview-period-ic"
                  />
                </span>
              }
            />
            <ToggleRow
              label="預估經期開始"
              checked={settings.calendarShowPredictPeriodStart}
              onChange={(v) => onPatch({ calendarShowPredictPeriodStart: v })}
              preview={
                <span className="cal-preview-cell">
                  <span className="cal-preview-num">1</span>
                  <Square
                    size={11}
                    strokeWidth={2.5}
                    className="cal-preview-ic cal-preview-ic-br cal-preview-ring"
                  />
                </span>
              }
            />
          </div>
        </section>

        <p className="muted tiny cal-display-attrib">
          圖示使用 Lucide Icons（開放授權），於專案內以套件方式載入。
        </p>

        <button
          type="button"
          className="cal-sheet-btn cal-sheet-btn-cancel"
          onClick={onClose}
        >
          完成
        </button>
      </div>
    </div>
  )
}
