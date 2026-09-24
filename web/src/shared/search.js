// 찾기 탭 검색 (명세 §5-4). Firestore 와 무관한 순수 함수 — scripts/test 에서 테스트한다.
import { buildCourse, composeContext } from './compose.js'
import { distanceKm } from './geo.js'
import { seededRandom, shuffle } from './random.js'

const DEFAULT_LIMIT = 30

/**
 * @param events   행사 캐시 코스 (events/{sido}.courses, 기간 있음)
 * @param pool     이번 주 코스 풀 (계절 코스·트렌드 코스를 살리려고 함께 본다)
 * @param places   decodePlace 한 장소들 (즉석 조합용)
 * @param area     { center: {lat,lng}, radiusKm } 또는 { sido }
 * @param period   { start, end } 'YYYY-MM-DD'
 * @param themes   고른 취향 (비면 전체)
 * @returns { limited: 이 기간에만, anytime: 언제든 가능 } — 각 코스에 distKm(중심이 있을 때)
 */
export function searchCourses({ events = [], pool = [], places = [], area, period, themes = [], seed = 'search', limit = DEFAULT_LIMIT }) {
  const liked = new Set(themes)
  const themeOk = (c) => liked.size === 0 || c.themes.some((t) => liked.has(t))
  const distOf = (c) => (area.center ? distanceKm(area.center, c) : null)
  const inArea = (c, d) => (area.center ? d <= area.radiusKm : c.sido === area.sido)
  const overlaps = (p) => p && p.start <= period.end && p.end >= period.start

  const usedMains = new Set()
  const accept = (c) => {
    const mainId = c.stops?.[0]?.contentId
    if (mainId && usedMains.has(mainId)) return null
    const d = distOf(c)
    if (!inArea(c, d) || !themeOk(c)) return null
    if (mainId) usedMains.add(mainId)
    return { ...c, distKm: d == null ? null : Math.round(d * 10) / 10 }
  }

  // 이 기간에만: 행사 캐시 + 이번 주 풀의 기간 있는 코스(트렌드 등) 중 기간이 겹치는 것
  const limited = []
  for (const c of [...pool.filter((c) => c.period), ...events]) {
    if (!overlaps(c.period)) continue
    const ok = accept(c)
    if (ok) limited.push(ok)
  }
  // 가까운 순(중심이 있을 때) 또는 먼저 시작하는 순
  limited.sort((a, b) => (area.center ? a.distKm - b.distKm : a.period.start.localeCompare(b.period.start)))

  // 언제든 가능: 이번 주 풀의 상시 코스 먼저, 모자라면 캐시된 장소로 즉석 조합
  const anytime = []
  for (const c of pool.filter((c) => !c.period)) {
    const ok = accept(c)
    if (ok) anytime.push(ok)
  }

  const rand = seededRandom(seed)
  let mains = places.filter((p) => p.role === 'main' && p.image && !usedMains.has(p.contentId) && themeOk(p))
  if (area.center) {
    mains = mains
      .map((p) => ({ p, d: distanceKm(area.center, p) }))
      .filter(({ d }) => d <= area.radiusKm)
      .sort((a, b) => a.d - b.d)
      .map(({ p }) => p)
  } else {
    mains = shuffle(
      mains.filter((p) => p.sido === area.sido),
      rand,
    )
  }
  if (anytime.length < limit && mains.length) {
    const ctx = composeContext(places, rand)
    for (const main of mains) {
      if (anytime.length >= limit) break
      if (usedMains.has(main.contentId)) continue
      const course = buildCourse(main, ctx, { kind: 'regular', requireFood: true })
      if (!course) continue
      const ok = accept({ id: `search-${main.contentId}`, source: 'A', ...course })
      if (ok) anytime.push(ok)
    }
  }
  if (area.center) anytime.sort((a, b) => a.distKm - b.distKm)

  return { limited: limited.slice(0, limit), anytime: anytime.slice(0, limit) }
}
