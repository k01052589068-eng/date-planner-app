// 시·도 이름을 짧은 표준형(서울, 경기, 충북 …)으로 맞춘다. 코스 풀 문서 ID(coursePool/{weekId}_{key})의 기준.
// 앱(web)과 파이프라인(scripts)이 함께 쓴다 — 외부 의존성 없이 유지할 것.
//
// 2026년 광주광역시와 전라남도가 전남광주통합특별시로 통합되어 하나의 지역(전남광주)으로 다룬다.
// (TourAPI 법정동 코드 12, 주소 '전남광주통합특별시 …')
export const SIDO = [
  { name: '서울', key: 'seoul', lDong: ['11'] },
  { name: '부산', key: 'busan', lDong: ['26'] },
  { name: '대구', key: 'daegu', lDong: ['27'] },
  { name: '인천', key: 'incheon', lDong: ['28'] },
  { name: '대전', key: 'daejeon', lDong: ['30'] },
  { name: '울산', key: 'ulsan', lDong: ['31'] },
  { name: '세종', key: 'sejong', lDong: ['36', '36110'] },
  { name: '경기', key: 'gyeonggi', lDong: ['41'] },
  { name: '강원', key: 'gangwon', lDong: ['51', '42'] },
  { name: '충북', key: 'chungbuk', lDong: ['43'] },
  { name: '충남', key: 'chungnam', lDong: ['44'] },
  { name: '전북', key: 'jeonbuk', lDong: ['52', '45'] },
  { name: '전남광주', key: 'jeonnam-gwangju', lDong: ['12', '29', '46'] },
  { name: '경북', key: 'gyeongbuk', lDong: ['47'] },
  { name: '경남', key: 'gyeongnam', lDong: ['48'] },
  { name: '제주', key: 'jeju', lDong: ['50'] },
]

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
