import { normalizeSido, sidoFromLDong } from '../../web/src/shared/regions.js'
import { fromCompact } from '../../web/src/shared/week.js'

// TourAPI 신 분류체계(lclsSystm) 코드 앞부분 → 코스에서의 역할.
// 더 긴(구체적인) 접두어가 먼저 맞도록 긴 것부터 검사한다.
//   themes: 앱 취향 카테고리 (web/src/settings.js 의 THEMES 와 같은 이름)
//   verb:   코스 제목에 붙는 말 ("서울숲 산책")
const MAIN_RULES = {
  // 축제·공연·행사
  EV01: { themes: ['축제·시즌 이벤트'], verb: '' },
  EV02: { themes: ['전시·공연'], verb: '관람' },
  EV0301: { themes: ['전시·공연', '실내(비 오는 날)'], verb: '관람' },
  EV0302: { themes: ['전시·공연', '실내(비 오는 날)'], verb: '구경' },
  EV03: { themes: ['축제·시즌 이벤트'], verb: '' },

  // 체험·레포츠
  EX02: { themes: ['액티비티·체험', '실내(비 오는 날)'], verb: '체험' },
  EX0501: { themes: ['액티비티·체험', '실내(비 오는 날)'], verb: '힐링' },
  EX0502: { themes: ['실내(비 오는 날)'], verb: '힐링' },
  EX0505: null, // 뷰티스파
  EX0506: null,
  EX0508: null, // 의료관광
  EX05: { themes: ['액티비티·체험'], verb: '힐링' },
  EX0601: { themes: ['자연·산책'], verb: '산책' }, // 근대산업유산
  EX06: null, // 공장·기업 견학 등
  EX0701: { themes: ['액티비티·체험', '드라이브'], verb: '유람' },
  EX: { themes: ['액티비티·체험'], verb: '체험' },
  LS: { themes: ['액티비티·체험'], verb: '체험' },

  // 자연
  NA0101: { themes: ['자연·산책', '드라이브'], verb: '산책' },
  NA0103: { themes: ['자연·산책', '드라이브'], verb: '나들이' },
  NA0104: { themes: ['자연·산책', '드라이브'], verb: '나들이' },
  NA0105: null,
  NA0202: { themes: ['자연·산책', '드라이브'], verb: '산책' },
  NA0205: { themes: ['자연·산책', '드라이브'], verb: '여행' },
  NA0206: null,
  NA0208: { themes: ['자연·산책', '드라이브'], verb: '드라이브' },
  NA0209: { themes: ['자연·산책', '드라이브'], verb: '바다 산책' },
  NA0301: { themes: ['자연·산책', '실내(비 오는 날)'], verb: '탐험' },
  NA04: { themes: ['자연·산책'], verb: '산책' },
  NA: { themes: ['자연·산책'], verb: '산책' },

  // 문화관광
  VE0102: { themes: ['자연·산책', '드라이브'], verb: '전망' },
  VE0103: { themes: ['자연·산책', '드라이브'], verb: '산책' },
  VE0107: { themes: ['자연·산책', '드라이브'], verb: '드라이브' },
  VE0108: { themes: ['자연·산책', '드라이브'], verb: '산책' },
  VE01: null, // 건물·동상·터널 등은 데이트 메인으로 약함
  VE0201: { themes: ['액티비티·체험'], verb: '나들이' },
  VE0202: { themes: ['액티비티·체험'], verb: '물놀이' },
  VE0203: { themes: ['액티비티·체험'], verb: '나들이' },
  VE0204: { themes: ['액티비티·체험', '실내(비 오는 날)'], verb: '구경' },
  VE0205: { themes: ['액티비티·체험'], verb: '별 보기' },
  VE0301: { themes: ['자연·산책'], verb: '산책' },
  VE0305: { themes: ['자연·산책'], verb: '산책' },
  VE03: null, // 소공원·어린이공원·근린공원
  VE0401: { themes: ['맛집·카페', '자연·산책'], verb: '골목 산책' },
  VE0402: { themes: ['자연·산책'], verb: '마을 산책' },
  VE0403: { themes: ['자연·산책'], verb: '걷기' },
  VE06: { themes: ['전시·공연', '실내(비 오는 날)'], verb: '관람' },
  VE0704: null, // 컨벤션센터
  VE07: { themes: ['전시·공연', '실내(비 오는 날)'], verb: '관람' },
  VE1201: { themes: ['실내(비 오는 날)'], verb: '책방 구경' },

  // 역사·종교
  HS0101: { themes: ['자연·산책'], verb: '산책' },
  HS0102: { themes: ['자연·산책'], verb: '성곽 산책' },
  HS0104: { themes: ['자연·산책'], verb: '산책' },
  HS0106: { themes: ['자연·산책'], verb: '산책' },
  HS0111: { themes: ['자연·산책'], verb: '산책' },
  HS0301: { themes: ['자연·산책'], verb: '산책' },

  // 쇼핑
  SH01: { themes: ['실내(비 오는 날)'], verb: '쇼핑' },
  SH0201: { themes: ['실내(비 오는 날)'], verb: '쇼핑' },
  SH0202: { themes: ['실내(비 오는 날)'], verb: '쇼핑' },
  SH06: { themes: ['맛집·카페'], verb: '시장 구경' },
}

const MAIN_PREFIXES = Object.keys(MAIN_RULES).sort((a, b) => b.length - a.length)

function mainRule(lcls) {
  const prefix = MAIN_PREFIXES.find((p) => lcls.startsWith(p))
  return prefix ? MAIN_RULES[prefix] : null
}

/** 음식점 분류 → 식사 정류장 종류와 이름표 */
function foodKind(lcls) {
  if (lcls.startsWith('FD05')) return { kind: 'cafe', label: '카페' }
  if (lcls.startsWith('FD01')) return { kind: 'meal', label: '한식' }
  if (lcls.startsWith('FD0201')) return { kind: 'meal', label: '중식' }
  if (lcls.startsWith('FD0202')) return { kind: 'meal', label: '일식' }
  if (lcls.startsWith('FD0203')) return { kind: 'meal', label: '양식' }
  if (lcls.startsWith('FD02')) return { kind: 'meal', label: '이색 음식' }
  if (lcls.startsWith('FD0301')) return { kind: 'cafe', label: '베이커리' }
  if (lcls.startsWith('FD03')) return { kind: 'meal', label: '분식·간식' }
  return null // 주점 등은 제외
}

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
