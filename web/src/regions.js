// 시·도 이름을 짧은 표준형(서울, 경기, 충북 …)으로 맞춘다. 코스 풀 문서 ID(coursePool/{weekId}_{sido})의 기준.
export const SIDO_LIST = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']

const LONG_NAMES = {
  충청북도: '충북',
  충청남도: '충남',
  전라북도: '전북',
  전북특별자치도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
}

/** '인천광역시', '인천 연수구 송도동', '충청남도' 등 → '인천', '충남'. 알 수 없으면 null. */
export function normalizeSido(text) {
  const first = (text || '').trim().split(/\s+/)[0]
  if (LONG_NAMES[first]) return LONG_NAMES[first]
  const short = first.slice(0, 2)
  return SIDO_LIST.includes(short) ? short : null
}
