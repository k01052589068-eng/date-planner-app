// 시·도 이름을 짧은 표준형(서울, 경기, 충북 …)으로 맞춘다. 코스 풀 문서 ID(coursePool/{weekId}_{key})의 기준.
// 앱(web)과 파이프라인(scripts)이 함께 쓴다 — 외부 의존성 없이 유지할 것.
//
// 2026년 광주광역시와 전라남도가 전남광주통합특별시로 통합되어 하나의 지역(전남광주)으로 다룬다.
// (TourAPI 법정동 코드 12, 주소 '전남광주통합특별시 …')
//
// bbox: [남, 서, 북, 동] — TourAPI 장소 좌표의 0.5~99.5 백분위 + 약 10km 여유 (2026-09 기준).
// 앱이 기준 위치 주변 지역의 코스 풀만 불러올 때 쓴다. 겹쳐도 괜찮고, 빠지는 곳이 없는 게 중요하다.
export const SIDO = [
  { name: '서울', key: 'seoul', lDong: ['11'], bbox: [37.4, 126.7, 37.8, 127.3] },
  { name: '부산', key: 'busan', lDong: ['26'], bbox: [34.9, 128.7, 35.5, 129.4] },
  { name: '대구', key: 'daegu', lDong: ['27'], bbox: [35.6, 128.3, 36.3, 128.9] },
  { name: '인천', key: 'incheon', lDong: ['28'], bbox: [37.1, 124.6, 38.1, 126.9] },
  { name: '대전', key: 'daejeon', lDong: ['30'], bbox: [36.1, 127.2, 36.6, 127.6] },
  { name: '울산', key: 'ulsan', lDong: ['31'], bbox: [35.2, 128.9, 35.8, 129.6] },
  { name: '세종', key: 'sejong', lDong: ['36', '36110'], bbox: [36.3, 127.1, 36.8, 127.5] },
  { name: '경기', key: 'gyeonggi', lDong: ['41'], bbox: [36.8, 126.4, 38.2, 127.8] },
  { name: '강원', key: 'gangwon', lDong: ['51', '42'], bbox: [37.0, 127.1, 38.6, 129.4] },
  { name: '충북', key: 'chungbuk', lDong: ['43'], bbox: [36.0, 127.2, 37.3, 128.6] },
  { name: '충남', key: 'chungnam', lDong: ['44'], bbox: [35.9, 126.0, 37.1, 127.7] },
  { name: '전북', key: 'jeonbuk', lDong: ['52', '45'], bbox: [35.2, 126.3, 36.2, 127.9] },
  { name: '전남광주', key: 'jeonnam-gwangju', lDong: ['12', '29', '46'], bbox: [34.0, 125.7, 35.5, 127.9] },
  { name: '경북', key: 'gyeongbuk', lDong: ['47'], bbox: [35.5, 127.8, 37.6, 131.0] },
  { name: '경남', key: 'gyeongnam', lDong: ['48'], bbox: [34.5, 127.5, 35.9, 129.2] },
  { name: '제주', key: 'jeju', lDong: ['50'], bbox: [33.1, 126.1, 34.0, 127.1] },
]

/** 한 점에서 reachKm 안에 걸치는 지역 이름들 (reachKm 이 Infinity 면 전체) */
export function sidosNear(point, reachKm) {
  if (!Number.isFinite(reachKm)) return SIDO_LIST
  return SIDO.filter(({ bbox: [s, w, n, e] }) => {
    // 상자 안에서 가장 가까운 점까지의 거리 (위도 1도 ≈ 111km, 경도는 위도에 따라 줄어듦)
    const lat = Math.min(Math.max(point.lat, s), n)
    const lng = Math.min(Math.max(point.lng, w), e)
    const dy = (lat - point.lat) * 111
    const dx = (lng - point.lng) * 111 * Math.cos((point.lat * Math.PI) / 180)
    return Math.hypot(dx, dy) <= reachKm
  }).map((s) => s.name)
}

export const SIDO_LIST = SIDO.map((s) => s.name)

const BY_NAME = Object.fromEntries(SIDO.map((s) => [s.name, s]))
const BY_LDONG = Object.fromEntries(SIDO.flatMap((s) => s.lDong.map((code) => [code, s.name])))

// 주소 첫 단어(또는 앞 두 글자) → 표준형
const ALIASES = {
  충청북도: '충북',
  충청남도: '충남',
  전라북도: '전북',
  전북특별자치도: '전북',
  전라남도: '전남광주',
  전남광주통합특별시: '전남광주',
  경상북도: '경북',
  경상남도: '경남',
  광주: '전남광주',
  전남: '전남광주',
}

/** '인천광역시', '인천 연수구 송도동', '충청남도', '광주광역시' 등 → '인천', '충남', '전남광주'. 알 수 없으면 null. */
export function normalizeSido(text) {
  const first = (text || '').trim().split(/\s+/)[0]
  if (ALIASES[first]) return ALIASES[first]
  if (BY_NAME[first]) return first
  const short = first.slice(0, 2)
  return ALIASES[short] ?? (BY_NAME[short] ? short : null)
}

/** TourAPI 법정동 시도 코드(lDongRegnCd) → 표준형. 모르면 null. */
export function sidoFromLDong(code) {
  return BY_LDONG[code] ?? null
}

export function sidoKey(name) {
  return BY_NAME[name]?.key ?? null
}
