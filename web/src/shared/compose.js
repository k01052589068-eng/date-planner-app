// 코스 조합 규칙 (명세 §5-3): 메인 1곳 + 주변 식사/카페 1곳 + 선택 1곳
// 파이프라인(주간 풀·행사 캐시)과 앱(찾기 탭의 즉석 조합)이 함께 쓴다.
import { foodKind, mainRule } from './categories.js'
import { distanceKm } from './geo.js'

const FOOD_RADIUS_KM = 2
const FOOD_FALLBACK_RADIUS_KM = 3 // 2km 안에 없으면 조금 넓혀 본다
const EXTRA_RADIUS_KM = 2
const PICK_FROM = 5 // 가까운 후보 몇 곳 중에서 고를지 (매번 다른 곳이 나오게)
const MAX_FOOD_REUSE = 2 // 한 묶음 안에서 같은 식당이 반복되는 횟수 제한

// 격자(약 5km) 공간 색인 — 주변 장소를 빠르게 찾는다
const CELL = 0.05

export class GridIndex {
  constructor(points) {
    this.cells = new Map()
    for (const p of points) {
      const key = this.#key(p.lat, p.lng)
      if (!this.cells.has(key)) this.cells.set(key, [])
      this.cells.get(key).push(p)
    }
  }

  #key(lat, lng) {
    return `${Math.floor(lat / CELL)}:${Math.floor(lng / CELL)}`
  }

  /** center 에서 radiusKm 안의 점들을 가까운 순으로 { point, distKm } (radiusKm 은 5km 이하) */
  near(center, radiusKm) {
    const ci = Math.floor(center.lat / CELL)
    const cj = Math.floor(center.lng / CELL)
    const found = []
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (const p of this.cells.get(`${ci + di}:${cj + dj}`) ?? []) {
          const d = distanceKm(center, p)
          if (d <= radiusKm) found.push({ point: p, distKm: d })
        }
      }
    }
    return found.sort((a, b) => a.distKm - b.distKm)
  }
}

/**
 * 조합에 쓰는 공용 상태. 같은 context 로 여러 코스를 만들면 식당 반복이 제한된다.
 * @param places role 이 'main'/'food' 인 장소들
 */
export function composeContext(places, rand) {
  return {
    rand,
    foodIndex: new GridIndex(places.filter((p) => p.role === 'food')),
    mainIndex: new GridIndex(places.filter((p) => p.role === 'main' && p.image)),
    foodUse: new Map(),
  }
}

/**
 * 메인 장소 하나로 코스를 만든다. requireFood 인데 주변에 먹을 곳이 없으면 null.
 * @returns id·weekId·source 를 뺀 코스 (호출하는 쪽에서 붙인다)
 */
export function buildCourse(main, ctx, { kind, requireFood, seasonNote = null }) {
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
    const pool = ranked.slice(0, PICK_FROM)
    return pool[Math.floor(ctx.rand() * pool.length)]
  }
  return null
}

function pickExtraPlace(main, ctx) {
  const candidates = ctx.mainIndex
    .near(main, EXTRA_RADIUS_KM)
    .filter(({ point }) => point.contentId !== main.contentId && point.name !== main.name && !point.period)
  if (!candidates.length) return null
  const pool = candidates.slice(0, PICK_FROM)
  return pool[Math.floor(ctx.rand() * pool.length)]
}

function stopOf(p, type, distKm) {
  return {
    name: p.name,
    type,
    lat: p.lat,
    lng: p.lng,
    addr: p.addr ?? '',
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

// ---------- 지역별 장소 캐시(places/{sidoKey}) 압축 형식 ----------
// Firestore 는 배열 안의 배열을 못 담아서 장소 하나를 탭으로 구분한 문자열로 저장한다.
//   "contentId \t 이름 \t 위도 \t 경도 \t 시군구 \t 분류코드 \t 사진경로"
const IMAGE_PREFIX = 'https://tong.visitkorea.or.kr/cms/resource/'

export function encodePlace(p) {
  const clean = (s) => String(s ?? '').replace(/[\t\n]/g, ' ')
  const image = p.image?.startsWith(IMAGE_PREFIX) ? p.image.slice(IMAGE_PREFIX.length) : (p.image ?? '')
  return [p.contentId, p.name, p.lat.toFixed(5), p.lng.toFixed(5), p.sigungu, p.lcls, image].map(clean).join('\t')
}

/** encodePlace 의 반대. 분류 규칙으로 role·themes·food 를 다시 붙인다. */
export function decodePlace(line, sido) {
  const [contentId, name, lat, lng, sigungu, lcls, image] = line.split('\t')
  const place = {
    contentId,
    name,
    lat: Number(lat),
    lng: Number(lng),
    sido,
    sigungu,
    lcls,
    image: image && !image.startsWith('http') ? IMAGE_PREFIX + image : image,
  }
  const food = foodKind(lcls)
  if (food) return { ...place, role: 'food', food }
  const rule = mainRule(lcls)
  return rule ? { ...place, role: 'main', themes: rule.themes, verb: rule.verb } : { ...place, role: null }
}
