// 이번 주 개인화 추천 (명세 §5-3 "개인화 선택"). Firestore 와 무관한 순수 함수 — scripts/test 에서 테스트한다.
import { distanceKm } from './geo.js'
import { hashString, seededRandom } from './random.js'

// 새로운 시도: 반경 밖이라도 이 거리 안에서만 고른다 (너무 먼 곳은 부담스럽다)
export const NOVELTY_EXTRA_KM = 60
const NATIONWIDE_SCALE_KM = 300 // 전국 설정일 때 가까울수록 가점을 주는 기준 거리

/**
 * 이번 주가 "새로운 시도"를 섞는 주인지. 커플마다 도는 주가 달라지도록 커플 ID 로 어긋나게 한다.
 * @param weekStart 'YYYY-MM-DD' (월요일)
 * @param everyWeeks 0 = 안 함, 1 = 매주, 2 = 2주마다, 4 = 4주마다
 */
export function isNoveltyWeek(weekStart, coupleId, everyWeeks) {
  if (!everyWeeks) return false
  const weekIndex = Math.round(Date.parse(`${weekStart}T00:00:00Z`) / (7 * 24 * 60 * 60 * 1000))
  return (weekIndex + hashString(coupleId)) % everyWeeks === 0
}

/**
 * 코스 풀에서 recCount 개를 고른다. 같은 입력이면 항상 같은 결과.
 * @param courses      이번 주 코스 풀(여러 지역 합친 것)
 * @param settings     { base: {lat,lng}, radiusKm (null=전국), themes: [], recCount }
 * @param seed         커플ID + 주차
 * @param noveltyDue   이번 주가 새로운 시도 주인지
 * @param excludeMainIds 최근 4주에 추천했거나 다이어리에 기록된 장소의 contentId
 * @returns 코스 배열 — 각 코스에 distKm(기준 위치에서), novel(새로운 시도) 추가
 */
export function recommend({ courses, settings, seed, noveltyDue = false, excludeMainIds = new Set() }) {
  const { base, radiusKm, themes = [], recCount } = settings
  const rand = seededRandom(seed)
  const radius = radiusKm ?? Infinity
  const liked = new Set(themes)

  // 후보 정리: 중복·제외 대상 빼고, 거리·취향 일치 계산
  const seenIds = new Set()
  const seenMains = new Set()
  const candidates = []
  for (const c of courses) {
    const mainId = c.stops?.[0]?.contentId
    if (seenIds.has(c.id) || (mainId && (seenMains.has(mainId) || excludeMainIds.has(mainId)))) continue
    seenIds.add(c.id)
    if (mainId) seenMains.add(mainId)
    const distKm = distanceKm(base, c)
    candidates.push({
      course: c,
      distKm,
      inRadius: distKm <= radius,
      themeMatch: liked.size === 0 || c.themes.some((t) => liked.has(t)),
      jitter: rand(), // 매주·커플마다 다른 조합이 나오게 하는 작은 무작위 점수
    })
  }

  const proximity = (d) => 2 * (1 - Math.min(d, Number.isFinite(radius) ? radius : NATIONWIDE_SCALE_KM) / (Number.isFinite(radius) ? radius : NATIONWIDE_SCALE_KM))
  const baseScore = (x) =>
    x.jitter +
    (x.themeMatch ? 3 : 0) + // 취향 일치
    (x.course.kind === 'irregular' ? 2 : 0) + // 이번 주 한정
    (x.course.source === 'C' ? 2 : 0) + // 트렌드 조사(C)
    proximity(x.distKm) // 가까울수록

  const picks = []
  const pickedMainNames = new Set()
  const themeUse = new Map()
  const maxIrregular = Math.ceil(recCount / 2)
  const irregularCount = () => picks.filter((p) => p.course.kind === 'irregular').length

  // 같은 테마·행사가 몰리지 않도록 이미 고른 것에 따라 감점하며 하나씩 고른다
  function pickBest(pool) {
    let best = null
    let bestScore = -Infinity
    for (const x of pool) {
      if (picks.includes(x) || pickedMainNames.has(x.course.stops?.[0]?.name)) continue
      if (x.course.kind === 'irregular' && irregularCount() >= maxIrregular) continue
      const score = baseScore(x) - 0.8 * (themeUse.get(x.course.themes[0]) ?? 0)
      if (score > bestScore) {
        best = x
        bestScore = score
      }
    }
    return best
  }

  function take(x, novel = false) {
    picks.push(x)
    x.novel = novel
    pickedMainNames.add(x.course.stops?.[0]?.name)
    const t = x.course.themes[0]
    themeUse.set(t, (themeUse.get(t) ?? 0) + 1)
  }

  const inRadius = candidates.filter((x) => x.inRadius)
  const normalCount = noveltyDue ? recCount - 1 : recCount
  while (picks.length < normalCount) {
    const x = pickBest(inRadius)
    if (!x) break
    take(x)
  }

  // 새로운 시도: 반경 밖(적당히 가까운 곳) 또는 고르지 않은 취향
  if (noveltyDue) {
    const novelPool = candidates.filter(
      (x) =>
        !picks.includes(x) &&
        ((!x.inRadius && x.distKm <= radius + NOVELTY_EXTRA_KM) || (x.inRadius && liked.size > 0 && !x.themeMatch)),
    )
    let best = null
    for (const x of novelPool) {
      const score = x.jitter + (x.course.kind === 'irregular' ? 1 : 0)
      if (!best || score > best.score) best = { x, score }
    }
    if (best) take(best.x, true)
  }

  // 반경 안 코스가 모자라면 가까운 순으로 채운다
  if (picks.length < recCount) {
    const rest = candidates.filter((x) => !picks.includes(x)).sort((a, b) => a.distKm - b.distKm)
    for (const x of rest) {
      if (picks.length >= recCount) break
      if (pickedMainNames.has(x.course.stops?.[0]?.name)) continue
      take(x)
    }
  }

  return picks.map((x) => ({ ...x.course, distKm: Math.round(x.distKm * 10) / 10, novel: x.novel }))
}
