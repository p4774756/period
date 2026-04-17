import type { UserGoal } from './types'

export function goalLabel(goal: UserGoal): string {
  switch (goal) {
    case 'contraception':
      return '避孕（重視風險提醒）'
    case 'trying':
      return '備孕（重視時機參考）'
    case 'tracking':
      return '僅紀錄週期與身體狀況'
  }
}

/** 首頁一列狀態：字少 */
export function todayStatusChip(
  goal: UserGoal,
  level: 'low' | 'mid' | 'high',
  phase: 'period' | 'follicular' | 'fertile' | 'luteal',
): string {
  if (goal === 'tracking') {
    return phaseShortLabel(phase)
  }
  const r = level === 'low' ? '低' : level === 'mid' ? '中' : '高'
  return `懷孕機率（推估）${r}`
}

export function phaseShortLabel(
  phase: 'period' | 'follicular' | 'fertile' | 'luteal',
): string {
  const m = {
    period: '經期中',
    follicular: '濾泡期',
    fertile: '接近排卵',
    luteal: '黃體期',
  }
  return m[phase]
}

export function riskNote(goal: UserGoal): string {
  switch (goal) {
    case 'contraception':
      return '日曆推估僅供參考，不能作為唯一避孕依據；易孕與否受個體差異影響。'
    case 'trying':
      return '排卵日為統計推估，實際排卵可能提早或延後；必要時搭配排卵試紙或諮詢醫師。'
    case 'tracking':
      return '以下為推估的週期階段說明，非醫療診斷。'
  }
}

export function bodyPhaseLine(
  goal: UserGoal,
  phase: 'period' | 'follicular' | 'fertile' | 'luteal',
): string {
  const neutral = {
    period: '經期：子宮內膜脫落出血，注意休息與保暖。',
    follicular: '濾泡期：激素逐漸回升，體力與情緒常逐步回穩。',
    fertile: '接近預估排卵：身體可能出現蛋清狀分泌物等變化（因人而異）。',
    luteal: '黃體期：黃體素上升，有些人會有經前不適。',
  }
  const contraception = {
    period: neutral.period,
    follicular: '濾泡期：仍以避孕措施為主，勿以「安全期」自行判斷。',
    fertile:
      '接近推估排卵：受孕風險相對提高，請勿單靠 App 推算作為避孕依據。',
    luteal: '黃體期：距離預估排卵已過，仍建議固定避孕方式。',
  }
  const trying = {
    period: neutral.period,
    follicular: '濾泡期：可開始留意身體訊號與排卵試紙（若使用）。',
    fertile: '接近推估排卵：若有備孕計畫，可與伴侶安排同房時機。',
    luteal: '黃體期：可持續觀察身體感受，驗孕請以檢驗或醫師判斷為準。',
  }

  const table =
    goal === 'contraception'
      ? contraception
      : goal === 'trying'
        ? trying
        : neutral
  return table[phase]
}

export function disclaimerParagraphs(): string[] {
  return [
    '本工具僅在您的裝置瀏覽器儲存資料，不會上傳至伺服器。',
    '所有預測皆為統計推估，不構成醫療診斷或治療建議；若有異常出血、劇痛或週期明顯改變，請尋求專業醫療協助。',
    '避孕請勿僅依賴日曆推算；備孕與避孕決策請搭配適當方式並諮詢醫師。',
    '瀏覽器通知需您允許權限，且關閉分頁後可能無法即時推播（依瀏覽器而定）。',
  ]
}
