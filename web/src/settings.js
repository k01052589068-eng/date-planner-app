import { doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase.js'

// 명세 §5-2. 취향 이름은 코스 데이터의 themes 값과 같아야 한다.
export const THEMES = ['맛집·카페', '전시·공연', '액티비티·체험', '자연·산책', '축제·시즌 이벤트', '실내(비 오는 날)', '드라이브']

// radiusKm: null = 전국
export const RADIUS_OPTIONS = [
  { value: 10, label: '10km' },
  { value: 30, label: '30km' },
  { value: 50, label: '50km' },
  { value: 100, label: '100km' },
  { value: null, label: '전국' },
]

// everyWeeks: 몇 주에 한 번 "새로운 시도" 코스를 섞는지 (0 = 안 함)
export const NOVELTY_OPTIONS = [
  { value: 'never', label: '안 함', everyWeeks: 0, hint: '설정한 위치·취향 안에서만 추천해요.' },
  { value: 'monthly', label: '가끔', everyWeeks: 4, hint: '4주에 한 번, 반경 밖이나 새로운 취향의 코스를 하나 섞어요.' },
  { value: 'biweekly', label: '보통', everyWeeks: 2, hint: '2주에 한 번, 반경 밖이나 새로운 취향의 코스를 하나 섞어요.' },
  { value: 'weekly', label: '자주', everyWeeks: 1, hint: '매주 반경 밖이나 새로운 취향의 코스를 하나 섞어요.' },
]

export const REC_COUNT_MIN = 3
export const REC_COUNT_MAX = 7

export const DEFAULT_SETTINGS = {
  base: null, // { name, address, lat, lng, sido }
  radiusKm: 30,
  themes: [],
  novelty: 'monthly',
  recCount: 5,
}

export function withDefaults(settings) {
  return { ...DEFAULT_SETTINGS, ...settings }
}

/** 설정 한 항목을 저장한다. 필드 단위로 써서 두 사람이 동시에 다른 항목을 바꿔도 덮어쓰지 않는다. */
export function saveSetting(coupleId, key, value) {
  return updateDoc(doc(db, 'couples', coupleId), { [`settings.${key}`]: value })
}
