// 화면 표시용 날짜·거리 문구

/** '2026-09-21' → '9월 21일' */
export function monthDay(ymd) {
  const [, m, d] = ymd.split('-').map(Number)
  return `${m}월 ${d}일`
}

/** 주 기간 → '9월 21일 ~ 27일' (달이 바뀌면 '9월 28일 ~ 10월 4일') */
export function weekRange({ start, end }) {
  const sameMonth = start.slice(5, 7) === end.slice(5, 7)
  return `${monthDay(start)} ~ ${sameMonth ? `${Number(end.slice(8, 10))}일` : monthDay(end)}`
}

/** 행사 기간 표시: 이미 시작했으면 '10월 5일까지', 아직이면 '9월 28일부터' */
export function periodLabel(period, today) {
  if (!period) return ''
  if (period.start > today) return `${monthDay(period.start)}부터`
  return `${monthDay(period.end)}까지`
}

/** 코스 안 이동 거리: 1.5km 이하는 걸어서 몇 분 */
export function hopLabel(km) {
  if (km <= 1.5) return `걸어서 ${Math.max(1, Math.round((km / 4) * 60))}분`
  return `${km.toFixed(1)}km`
}

export function kakaoMapLink({ name, lat, lng }) {
  return `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** '2026-09-21' → '9월 21일 (월)' */
export function dateWithWeekday(ymd) {
  const day = new Date(`${ymd}T00:00:00Z`).getUTCDay()
  return `${monthDay(ymd)} (${WEEKDAYS[day]})`
}

/** '2026-09' → '2026년 9월' */
export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  return `${y}년 ${m}월`
}

export function won(n) {
  return `${n.toLocaleString('ko-KR')}원`
}
