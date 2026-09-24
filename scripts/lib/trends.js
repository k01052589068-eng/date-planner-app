// C 파이프라인: data/trends/{weekId}.json 검증·보강
import { buildCourse, composeContext } from '../../web/src/shared/compose.js'
import { seededRandom } from '../../web/src/shared/random.js'
import { normalizeSido } from '../../web/src/shared/regions.js'
import { addDays, weekFromId } from '../../web/src/shared/week.js'
import { THEMES } from '../../web/src/shared/themes.js'

const MAX_TITLE = 80
const EVENT_WINDOW_DAYS = 90
const inKorea = (lat, lng) => lat >= 33 && lat <= 38.7 && lng >= 124.5 && lng <= 132
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))
const isUrl = (s) => typeof s === 'string' && /^https?:\/\/\S+$/.test(s)

/**
 * 트렌드 파일을 검증하고 앱이 쓰는 코스 형식으로 정리한다.
 * @returns { courses, errors: string[], warnings: string[] } — errors 가 있으면 올리지 않는다
 */
export function validateTrends(json, expectedWeekId) {
  const errors = []
  const warnings = []
  if (!json || typeof json !== 'object') return { courses: [], errors: ['JSON 객체가 아니에요.'], warnings }
  if (json.weekId !== expectedWeekId) errors.push(`weekId(${json.weekId})가 파일 이름(${expectedWeekId})과 달라요.`)
  let week
  try {
    week = weekFromId(expectedWeekId)
  } catch (e) {
    return { courses: [], errors: [e.message], warnings }
  }
  const windowEnd = addDays(week.start, EVENT_WINDOW_DAYS)
  if (!Array.isArray(json.courses) || json.courses.length === 0) errors.push('courses 가 비어 있어요.')

  const courses = []
  const ids = new Set()
  ;(json.courses ?? []).forEach((raw, i) => {
    const where = `courses[${i}]${raw?.title ? ` "${raw.title}"` : ''}`
    const err = (msg) => errors.push(`${where}: ${msg}`)

    const title = String(raw?.title ?? '').trim()
    if (!title) err('title 이 없어요.')
    if (title.length > MAX_TITLE) err(`title 이 너무 길어요 (${MAX_TITLE}자 이하).`)

    const themes = (raw?.themes ?? []).filter((t) => THEMES.includes(t))
    if (!themes.length) err(`themes 는 다음 중 하나 이상이어야 해요: ${THEMES.join(', ')}`)
    const unknownThemes = (raw?.themes ?? []).filter((t) => !THEMES.includes(t))
    if (unknownThemes.length) warnings.push(`${where}: 모르는 테마는 뺐어요 (${unknownThemes.join(', ')})`)

    const period = raw?.period ?? null
    const kind = raw?.kind ?? (period ? 'irregular' : 'regular')
    if (!['regular', 'irregular'].includes(kind)) err('kind 는 regular 또는 irregular 예요.')
    if (kind === 'irregular') {
      if (!period || !isDate(period.start) || !isDate(period.end)) err('기간 한정(irregular)은 period.start/end(YYYY-MM-DD)가 필요해요.')
      else if (period.start > period.end) err('period.start 가 end 보다 늦어요.')
      else if (period.end < week.start) err(`이미 끝난 행사예요 (${period.end}).`)
      else if (period.start > windowEnd) err(`90일 뒤 행사라 넣지 않아요 (${period.start}).`)
    } else if (period) {
      err('상시(regular) 코스에는 period 를 넣지 않아요.')
    }

    const stops = Array.isArray(raw?.stops) ? raw.stops : []
    if (!stops.length) err('stops 가 비어 있어요 (메인 장소 1곳 이상).')
    const cleanStops = stops.map((s, j) => {
      const lat = Number(s?.lat)
      const lng = Number(s?.lng)
      if (!s?.name) err(`stops[${j}].name 이 없어요.`)
      if (!inKorea(lat, lng)) err(`stops[${j}] "${s?.name ?? ''}" 좌표가 없거나 한국 밖이에요 (geocode 로 채우세요).`)
      return {
        order: j + 1,
        name: String(s?.name ?? '').trim(),
        type: s?.type ?? (j === 0 ? (kind === 'irregular' ? 'event' : 'place') : 'place'),
        lat,
        lng,
        addr: String(s?.addr ?? ''),
        contentId: String(s?.contentId ?? ''),
        url: isUrl(s?.url) ? s.url : '',
        distKm: 0,
      }
    })

    const sources = (raw?.sources ?? []).filter(isUrl)
    if (!sources.length) err('sources 에 확인한 출처 URL 이 하나 이상 있어야 해요.')
    else if (sources.length < 2) warnings.push(`${where}: 출처가 1개예요. 가능하면 2개 이상으로 교차 확인해 주세요.`)

    const sido = normalizeSido(raw?.sido) ?? normalizeSido(cleanStops[0]?.addr)
    if (!sido) err(`sido 를 알 수 없어요 (${raw?.sido ?? ''}).`)

    const id = String(raw?.id ?? '').trim() || `${expectedWeekId}-C-${String(i + 1).padStart(3, '0')}`
    if (ids.has(id)) err(`id 가 중복돼요 (${id}).`)
    ids.add(id)

    courses.push({
      id,
      weekId: expectedWeekId,
      source: 'C',
      kind,
      title,
      summary: String(raw?.summary ?? '').trim(),
      themes,
      sido,
      sigungu: String(raw?.sigungu ?? ''),
      lat: cleanStops[0]?.lat,
      lng: cleanStops[0]?.lng,
      period: kind === 'irregular' ? period : null,
      image: isUrl(raw?.image) ? raw.image.replace(/^http:\/\//, 'https://') : '',
      stops: cleanStops,
      sources,
      seasonNote: raw?.seasonNote ? String(raw.seasonNote) : null,
    })
  })
  return { courses, errors, warnings }
}

/**
 * 메인 장소만 적힌 트렌드 코스에 A 와 같은 규칙으로 주변 식사·카페를 붙인다.
 * @param placesBySido { [sido]: decodePlace 한 장소들 }
 */
export function enrichWithFood(courses, placesBySido) {
  return courses.map((c) => {
    if (c.stops.length > 1) return c
    const places = placesBySido[c.sido] ?? []
    if (!places.length) return c
    const [first] = c.stops
    const main = {
      contentId: first.contentId || `c:${c.id}`,
      name: first.name,
      addr: first.addr,
      lat: first.lat,
      lng: first.lng,
      sido: c.sido,
      sigungu: c.sigungu,
      themes: c.themes,
      verb: '',
      period: c.period ?? undefined,
      image: c.image,
      role: 'main',
    }
    const built = buildCourse(main, composeContext(places, seededRandom(c.id)), { kind: c.kind, requireFood: false })
    const stops = built.stops.map((s, i) => (i === 0 ? { ...s, type: first.type, url: first.url } : s))
    return { ...c, stops }
  })
}
