import { normalizeSido, sidoFromLDong } from '../../web/src/shared/regions.js'
import { MAIN_RULES, foodKind, mainRule } from '../../web/src/shared/categories.js'
import { fromCompact } from '../../web/src/shared/week.js'

/**
 * TourAPI item → 앱에서 쓰는 장소. 좌표·지역을 알 수 없으면 null.
 * role: 'main'(코스의 중심) | 'food'(식사·카페) | null(쓰지 않음)
 */
export function normalizePlace(item) {
  const lat = Number(item.mapy)
  const lng = Number(item.mapx)
  // 좌표가 없거나 한국 밖으로 찍힌 항목(원본 데이터 오류)은 버린다
  if (!(lat >= 33 && lat <= 38.7 && lng >= 124.5 && lng <= 132)) return null
  // 주소가 법정동 코드보다 정확하다 (코드가 틀린 항목이 드물게 있음)
  const sido = normalizeSido(item.addr1) ?? sidoFromLDong(item.lDongRegnCd)
  if (!sido) return null

  const lcls = item.lclsSystm3 || item.lclsSystm2 || ''
  const place = {
    contentId: item.contentid,
    contentTypeId: item.contenttypeid,
    name: item.title.trim(),
    addr: item.addr1 || '',
    sido,
    sigungu: sigunguOf(item.addr1),
    lat,
    lng,
    lcls,
    image: (item.firstimage || '').replace(/^http:\/\//, 'https://'), // 앱(https)에서 섞인 콘텐츠로 막히지 않게
  }
  if (item.eventstartdate && item.eventenddate) {
    place.period = { start: fromCompact(item.eventstartdate), end: fromCompact(item.eventenddate) }
  }

  const food = foodKind(lcls)
  if (food) return { ...place, role: 'food', food }

  const rule = item.contenttypeid === '15' ? (mainRule(lcls) ?? MAIN_RULES.EV01) : mainRule(lcls)
  if (rule) return { ...place, role: 'main', themes: rule.themes, verb: rule.verb }
  return { ...place, role: null }
}

/** '인천광역시 연수구 …' → '연수구', '경기도 가평군 …' → '가평군' */
function sigunguOf(addr) {
  const parts = (addr || '').trim().split(/\s+/)
  const second = parts[1] || ''
  // '성남시 분당구' 처럼 시 아래 구가 있으면 둘 다
  if (/시$/.test(second) && /구$/.test(parts[2] || '')) return `${second} ${parts[2]}`
  return /(시|군|구)$/.test(second) ? second : ''
}
