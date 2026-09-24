import { SIDO, sidoKey } from '../../web/src/regions.js'
import { GridIndex } from './geo.js'
import { seededRandom, shuffle } from './random.js'

// 코스 조합 규칙 (명세 §5-3): 메인 1곳 + 주변 식사/카페 1곳 + 선택 1곳
const FOOD_RADIUS_KM = 2
const FOOD_FALLBACK_RADIUS_KM = 3 // 2km 안에 없으면 조금 넓혀 본다
const EXTRA_RADIUS_KM = 2
const FOOD_PICK_FROM = 5 // 가까운 후보 몇 곳 중에서 고를지 (매주 다른 곳이 나오게)
const MAX_FOOD_REUSE = 2 // 한 지역 풀에서 같은 식당이 반복되는 횟수 제한

// 지역별 풀 크기
const MAX_IRREGULAR = 40
const MAX_REGULAR = 50
const MAX_SEASONAL = 15 // 정기 코스 중 계절 키워드로 찾은 곳 최대 개수

/**
 * 한 주의 코스 풀을 지역별로 만든다.
 * @param places   normalizePlace 결과 (관광지·문화시설·레포츠·음식점)
 * @param festivals normalizePlace 결과 (행사, period 포함)
 * @param seasonal Map<contentId, seasonNote> — 계절 키워드 검색으로 찾은 장소
 * @returns { [sido]: course[] }
 */
export function composeWeek({ week, places, festivals, seasonal = new Map() }) {
  const foods = places.filter((p) => p.role === 'food')
  const foodIndex = new GridIndex(foods)
  const mainIndex = new GridIndex(places.filter((p) => p.role === 'main' && p.image))

  const pools = {}
  for (const { name: sido } of SIDO) {
    const rand = seededRandom(`${week.weekId}:${sido}`)
    const foodUse = new Map()
    const ctx = { rand, foodIndex, mainIndex, foodUse }

    // 이번 주(월~일)와 기간이 겹치는 행사
    const events = shuffle(
      festivals.filter((f) => f.sido === sido && f.period && f.period.start <= week.end && f.period.end >= week.start),
      rand,
    )
    const irregular = []
    for (const ev of events) {
      if (irregular.length >= MAX_IRREGULAR) break
      irregular.push(buildCourse(ev, ctx, { kind: 'irregular', requireFood: false }))
    }

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
    pools[sido] = [...irregular, ...regular].filter(Boolean).map((c, i) => ({
      id: `${week.weekId}-${key}-${String(i + 1).padStart(3, '0')}`,
      weekId: week.weekId,
      source: 'A',
      ...c,
    }))
  }
  return pools
}

function buildCourse(main, ctx, { kind, requireFood, seasonNote = null }) {
  const food = pickFood(main, ctx, 'meal') ?? pickFood(main, ctx, 'cafe')
  if (requireFood && !food) return null

  // 선택 정류장: 식사를 골랐으면 카페, 아니면 근처 다른 볼거리
  let extra = food?.point.food.kind === 'meal' ? pickFood(main, ctx, 'cafe') : null
  if (!extra) extra = pickExtraPlace(main, ctx)

  const stops = [
    stopOf(main, kind === 'irregular' ? 'event' : 'place', 0),
    food && stopOf(food.point, food.point.food.kind, food.distKm),
    extra && stopOf(extra.point, extra.point.role === 'food' ? extra.point.food.kind : 'place', extra.distKm),
  ]
    .filter(Boolean)
    .map((s, i) => ({ order: i + 1, ...s }))

  for (const s of [food, extra]) {
    if (s?.point.role === 'food') ctx.foodUse.set(s.point.contentId, (ctx.foodUse.get(s.point.contentId) ?? 0) + 1)
  }

  const themes = [...new Set([...main.themes, ...(extra?.point.role === 'main' ? extra.point.themes : [])])]

  return {
    kind,
    title: titleOf(main, food?.point, extra?.point),
    summary: summaryOf(main, food, extra),
    themes,
    sido: main.sido,
    sigungu: main.sigungu,
    lat: main.lat,
    lng: main.lng,
    period: main.period ?? null,
    image: main.image,
    stops,
    sources: [],
    seasonNote,
  }
}

function pickFood(main, ctx, kind) {
  for (const radius of [FOOD_RADIUS_KM, FOOD_FALLBACK_RADIUS_KM]) {
    const candidates = ctx.foodIndex
      .near(main, radius)
      .filter(({ point }) => point.food.kind === kind && (ctx.foodUse.get(point.contentId) ?? 0) < MAX_FOOD_REUSE)
    if (!candidates.length) continue
    // 사진이 있는 곳을 조금 더 앞에
    const ranked = [...candidates.filter((c) => c.point.image), ...candidates.filter((c) => !c.point.image)]
    const pool = ranked.slice(0, FOOD_PICK_FROM)
    return pool[Math.floor(ctx.rand() * pool.length)]
  }
  return null
}

function pickExtraPlace(main, ctx) {
  const candidates = ctx.mainIndex
    .near(main, EXTRA_RADIUS_KM)
    .filter(({ point }) => point.contentId !== main.contentId && point.name !== main.name && !point.period)
  if (!candidates.length) return null
  const pool = candidates.slice(0, FOOD_PICK_FROM)
  return pool[Math.floor(ctx.rand() * pool.length)]
}

function stopOf(p, type, distKm) {
  return {
    name: p.name,
    type,
    lat: p.lat,
    lng: p.lng,
    addr: p.addr,
    contentId: p.contentId,
    url: '',
    distKm: Math.round(distKm * 10) / 10,
    ...(p.role === 'food' ? { label: p.food.label } : {}),
  }
}

function foodPhrase(food) {
  return food.food.kind === 'cafe' ? food.food.label : `${food.food.label} 맛집`
}

/** 제목용 짧은 이름: '신선대와 억새평전 (무등산권 국가지질공원)' → '신선대와 억새평전' */
function shortName(name) {
  return name.replace(/\s*[(（[][^)）\]]*[)）\]]/g, '').trim() || name
}

function titleOf(main, food, extra) {
  const head = [shortName(main.name), main.verb].filter(Boolean).join(' ')
  const tail = [food && foodPhrase(food), extra && (extra.role === 'food' ? foodPhrase(extra) : shortName(extra.name))].filter(Boolean)
  return [head, ...tail].join(' + ')
}

function summaryOf(main, food, extra) {
  const where = [main.sigungu, main.name].filter(Boolean).join(' ')
  if (!food) return `${where}에서 즐기는 데이트`
  const walk = (d) => (d <= 1.5 ? `걸어서 ${Math.max(1, Math.round((d / 4) * 60))}분` : `약 ${d.toFixed(1)}km`)
  const parts = [`${where} 들렀다가 ${walk(food.distKm)} 거리 ${food.point.name}에서 ${food.point.food.kind === 'cafe' ? '쉬어 가기' : '식사'}`]
  if (extra) parts.push(extra.point.role === 'food' ? `${extra.point.name}에서 마무리` : `${extra.point.name}까지 둘러보기`)
  return parts.join(', ')
}
