import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from './firebase.js'
import { NOVELTY_OPTIONS, withDefaults } from './settings.js'
import { NOVELTY_EXTRA_KM, isNoveltyWeek, recommend } from './shared/recommend.js'
import { sidoKey, sidosNear } from './shared/regions.js'
import { kstDate, weekOf, weeksBefore } from './shared/week.js'

const HISTORY_WEEKS = 4 // 최근 4주 안에 추천한 장소는 다시 추천하지 않는다

export function currentWeek() {
  return weekOf(kstDate())
}

export function recsCollection(coupleId) {
  return collection(db, 'couples', coupleId, 'weeklyRecs')
}

/** 추천에 영향을 주는 설정만 뽑는다. 저장된 추천과 비교해 설정이 바뀌었는지 알 수 있다. */
export function settingsSnapshot(rawSettings) {
  const s = withDefaults(rawSettings)
  return {
    base: s.base ? { name: s.base.name, lat: s.base.lat, lng: s.base.lng } : null,
    radiusKm: s.radiusKm,
    themes: s.themes,
    novelty: s.novelty,
    recCount: s.recCount,
  }
}

export function settingsChanged(recs, rawSettings) {
  return JSON.stringify(recs.basedOn) !== JSON.stringify(settingsSnapshot(rawSettings))
}

/** 불러올 지역: 반경 안 (새로운 시도 주에는 반경 밖 조금 더) */
function nearbySidos(settings, noveltyDue = false) {
  if (settings.radiusKm == null) return sidosNear(settings.base, Infinity)
  return sidosNear(settings.base, settings.radiusKm + (noveltyDue ? NOVELTY_EXTRA_KM : 0))
}

/** 주차의 코스 풀(기준 위치 주변 지역만). 하나도 없으면 null. */
async function loadPool(weekId, sidos) {
  const snaps = await Promise.all(sidos.map((name) => getDoc(doc(db, 'coursePool', `${weekId}_${sidoKey(name)}`))))
  const found = snaps.filter((s) => s.exists())
  if (!found.length) return null
  // trendCourses: 8단계 C 파이프라인이 같은 문서에 넣을 코스
  return found.flatMap((s) => [...(s.data().courses ?? []), ...(s.data().trendCourses ?? [])])
}

/** 이번 주 코스 풀이 올라왔는지 (지난주 풀로 임시 추천한 뒤 다시 확인할 때) */
export async function hasPool(couple, weekId) {
  const settings = withDefaults(couple.settings)
  if (!settings.base) return false
  const [first] = nearbySidos(settings)
  if (!first) return false
  return (await getDoc(doc(db, 'coursePool', `${weekId}_${sidoKey(first)}`))).exists()
}

/**
 * 이번 주 추천을 만들어 couples/{id}/weeklyRecs/{weekId} 에 저장한다.
 * 시드가 커플ID + 주차라서 두 사람이 따로 만들어도 같은 결과가 나온다.
 * @returns 저장한 문서 데이터, 코스 풀이 아직 없으면 null
 */
export async function generateRecs(couple, week) {
  const settings = withDefaults(couple.settings)
  if (!settings.base) return null

  const everyWeeks = NOVELTY_OPTIONS.find((o) => o.value === settings.novelty)?.everyWeeks ?? 0
  const noveltyDue = isNoveltyWeek(week.start, couple.id, everyWeeks)
  const sidos = nearbySidos(settings, noveltyDue)
  let poolWeekId = week.weekId
  let pool = await loadPool(poolWeekId, sidos)
  if (!pool) {
    // 월요일 새벽 등 이번 주 풀이 아직 없으면 지난주 풀로 임시 추천
    poolWeekId = weeksBefore(week.weekId, 1)
    pool = await loadPool(poolWeekId, sidos)
  }
  if (!pool) return null

  // 최근 4주 추천과 다이어리에 기록한 장소는 제외
  const exclude = new Set()
  const history = await getDocs(
    query(
      recsCollection(couple.id),
      where('weekId', '>=', weeksBefore(week.weekId, HISTORY_WEEKS)),
      where('weekId', '<', week.weekId),
    ),
  )
  history.forEach((d) => d.data().courses?.forEach((c) => c.stops?.[0]?.contentId && exclude.add(c.stops[0].contentId)))
  const diary = await getDocs(collection(db, 'couples', couple.id, 'diary'))
  diary.forEach((d) => d.data().places?.forEach((p) => p.contentId && exclude.add(p.contentId)))

  const courses = recommend({
    courses: pool,
    settings,
    seed: `${couple.id}:${week.weekId}`,
    noveltyDue,
    excludeMainIds: exclude,
  })

  const data = {
    weekId: week.weekId,
    period: { start: week.start, end: week.end },
    poolWeekId,
    basedOn: settingsSnapshot(couple.settings),
    courses,
    createdAt: serverTimestamp(),
  }
  await setDoc(doc(recsCollection(couple.id), week.weekId), data)
  return data
}
