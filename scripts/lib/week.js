// 주차 계산. 기준 시간대는 한국(KST, UTC+9), 주는 월~일(ISO 8601 주차).
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Date → KST 기준 'YYYY-MM-DD' */
export function kstDate(date = new Date()) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

function parseDay(ymd) {
  return new Date(`${ymd}T00:00:00Z`)
}

function formatDay(d) {
  return d.toISOString().slice(0, 10)
}

export function addDays(ymd, days) {
  return formatDay(new Date(parseDay(ymd).getTime() + days * DAY_MS))
}

/** 'YYYY-MM-DD' 가 속한 주: { weekId: '2026-W39', start: 월요일, end: 일요일 } */
export function weekOf(ymd) {
  const d = parseDay(ymd)
  const dayNum = (d.getUTCDay() + 6) % 7 // 월=0 … 일=6
  const start = new Date(d.getTime() - dayNum * DAY_MS)
  // ISO 주차: 그 주의 목요일이 속한 해가 주차의 해
  const thursday = new Date(start.getTime() + 3 * DAY_MS)
  const year = thursday.getUTCFullYear()
  const jan1 = Date.UTC(year, 0, 1)
  const week = Math.floor((thursday.getTime() - jan1) / DAY_MS / 7) + 1
  return {
    weekId: `${year}-W${String(week).padStart(2, '0')}`,
    start: formatDay(start),
    end: formatDay(new Date(start.getTime() + 6 * DAY_MS)),
  }
}

/** '2026-W39' → 그 주 */
export function weekFromId(weekId) {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekId)
  if (!m) throw new Error(`주차 형식이 아니에요: ${weekId} (예: 2026-W39)`)
  const [year, week] = [Number(m[1]), Number(m[2])]
  // 1월 4일은 항상 1주차에 속한다
  const w1 = weekOf(`${year}-01-04`)
  const result = weekOf(addDays(w1.start, (week - 1) * 7))
  if (result.weekId !== weekId) throw new Error(`없는 주차예요: ${weekId}`)
  return result
}

/** n주 전 주차 ID */
export function weeksBefore(weekId, n) {
  return weekOf(addDays(weekFromId(weekId).start, -7 * n)).weekId
}

/** 'YYYYMMDD' ↔ 'YYYY-MM-DD' */
export function toCompact(ymd) {
  return ymd.replaceAll('-', '')
}

export function fromCompact(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}
