import { buildCourse, composeContext, encodePlace } from '../../web/src/shared/compose.js'
import { seededRandom, shuffle } from '../../web/src/shared/random.js'
import { SIDO, sidoKey } from '../../web/src/shared/regions.js'
import { addDays } from '../../web/src/shared/week.js'

// 지역별 주간 풀 크기
const MAX_IRREGULAR = 40
const MAX_REGULAR = 50
const MAX_SEASONAL = 15 // 정기 코스 중 계절 키워드로 찾은 곳 최대 개수

export const EVENT_WINDOW_DAYS = 90 // 행사 캐시: 앞으로 90일 (명세 §5-4)

const overlaps = (period, start, end) => period && period.start <= end && period.end >= start

/**
 * 한 주의 코스 풀을 지역별로 만든다.
 * @param places   normalizePlace 결과 (관광지·문화시설·레포츠·음식점)
 * @param festivals normalizePlace 결과 (행사, period 포함)
 * @param seasonal Map<contentId, seasonNote> — 계절 키워드 검색으로 찾은 장소
 * @returns { [sido]: course[] }
 */
export function composeWeek({ week, places, festivals, seasonal = new Map() }) {
  const pools = {}
  for (const { name: sido } of SIDO) {
    const rand = seededRandom(`${week.weekId}:${sido}`)
    const ctx = composeContext(places, rand)

    // 이번 주(월~일)와 기간이 겹치는 행사
    const events = shuffle(
      festivals.filter((f) => f.sido === sido && overlaps(f.period, week.start, week.end)),
      rand,
    )
    const irregular = events.slice(0, MAX_IRREGULAR).map((ev) => buildCourse(ev, ctx, { kind: 'irregular', requireFood: false }))

    // 상시 코스: 계절 키워드 장소를 먼저, 나머지는 테마별로 고르게
    const mains = places.filter((p) => p.sido === sido && p.role === 'main' && p.image)
    const seasonalMains = shuffle(
      mains.filter((p) => seasonal.has(p.contentId)),
      rand,
    ).slice(0, MAX_SEASONAL)
    const byTheme = new Map()
    for (const p of shuffle(mains, rand)) {
      if (seasonal.has(p.contentId)) continue
      const theme = p.themes[0]
      if (!byTheme.has(theme)) byTheme.set(theme, [])
      byTheme.get(theme).push(p)
    }

    const regular = []
    const usedMain = new Set()
    const tryAdd = (p, seasonNote) => {
      if (regular.length >= MAX_REGULAR || usedMain.has(p.contentId)) return
      const course = buildCourse(p, ctx, { kind: 'regular', requireFood: true, seasonNote })
      if (!course) return
      usedMain.add(p.contentId)
      for (const s of course.stops) usedMain.add(s.contentId)
      regular.push(course)
    }
    for (const p of seasonalMains) tryAdd(p, seasonal.get(p.contentId))
    // 테마를 돌아가며 하나씩 (한 테마가 풀을 독차지하지 않도록)
    const queues = shuffle([...byTheme.values()], rand)
    while (regular.length < MAX_REGULAR && queues.some((q) => q.length)) {
      for (const q of queues) if (q.length) tryAdd(q.shift())
    }

    const key = sidoKey(sido)
    pools[sido] = [...irregular, ...regular].map((c, i) => ({
      id: `${week.weekId}-${key}-${String(i + 1).padStart(3, '0')}`,
      weekId: week.weekId,
      source: 'A',
      ...c,
    }))
  }
  return pools
}

/**
 * 찾기 탭용 행사 캐시: 이번 주 월요일부터 90일 안에 열리는 행사를 지역별 코스로.
 * @returns { range: {start,end}, bySido: { [sido]: course[] } }
 */
export function composeEvents({ week, places, festivals }) {
  const range = { start: week.start, end: addDays(week.start, EVENT_WINDOW_DAYS) }
  const bySido = {}
  for (const { name: sido } of SIDO) {
    const ctx = composeContext(places, seededRandom(`events:${week.weekId}:${sido}`))
    bySido[sido] = festivals
      .filter((f) => f.sido === sido && overlaps(f.period, range.start, range.end))
      .sort((a, b) => a.period.start.localeCompare(b.period.start))
      .map((ev) => ({
        id: `event-${ev.contentId}`,
        source: 'A',
        ...buildCourse(ev, ctx, { kind: 'irregular', requireFood: false }),
      }))
  }
  return { range, bySido }
}

/** 찾기 탭의 즉석 조합용 장소 캐시: 지역별 메인(사진 있는 곳)·식사 장소를 압축 문자열로 */
export function placeCache(places) {
  const bySido = {}
  for (const { name: sido } of SIDO) bySido[sido] = { main: [], food: [] }
  for (const p of places) {
    if (p.role === 'main' && p.image && !p.period) bySido[p.sido].main.push(encodePlace(p))
    else if (p.role === 'food') bySido[p.sido].food.push(encodePlace(p))
  }
  return bySido
}
