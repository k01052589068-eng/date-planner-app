import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { SIDO, sidoKey } from '../../web/src/shared/regions.js'
import { addDays, weeksBefore } from '../../web/src/shared/week.js'

const KEEP_WEEKS = 4 // 이번 주 + 지난 4주 풀을 남긴다 (명세: 지난 주차는 4주 후 삭제)
const MAX_DOC_BYTES = 900 * 1024 // Firestore 문서 한도 1MiB 에 여유를 둔다

/**
 * 인증: GitHub Actions 는 FIREBASE_SERVICE_ACCOUNT(JSON 문자열),
 * 로컬은 GOOGLE_APPLICATION_CREDENTIALS(키 파일 경로).
 */
export function initFirestore() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!json && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('업로드하려면 FIREBASE_SERVICE_ACCOUNT 또는 GOOGLE_APPLICATION_CREDENTIALS 가 필요해요. scripts/.env 를 확인해 주세요.')
  }
  const app = initializeApp({ credential: json ? cert(JSON.parse(json)) : applicationDefault() })
  const db = getFirestore(app)
  db.settings({ ignoreUndefinedProperties: true })
  return db
}

/**
 * coursePool/{weekId}_{sidoKey} 에 A 파이프라인 코스를 쓴다.
 * merge 로 쓰므로 C 파이프라인이 같은 문서에 넣은 필드(8단계)는 지워지지 않는다.
 */
export async function uploadPools(db, week, pools) {
  const batch = db.batch()
  for (const [sido, courses] of Object.entries(pools)) {
    const data = {
      weekId: week.weekId,
      sido,
      sidoKey: sidoKey(sido),
      period: { start: week.start, end: week.end },
      courses,
      generatedAt: FieldValue.serverTimestamp(),
    }
    const bytes = Buffer.byteLength(JSON.stringify(data))
    if (bytes > MAX_DOC_BYTES) throw new Error(`${sido} 풀이 너무 커요 (${Math.round(bytes / 1024)}KB). 코스 수를 줄여야 해요.`)
    batch.set(db.doc(`coursePool/${week.weekId}_${sidoKey(sido)}`), data, { merge: true })
  }
  await batch.commit()
  return Object.keys(pools).length
}

function checkSize(label, data) {
  const bytes = Buffer.byteLength(JSON.stringify(data))
  if (bytes > MAX_DOC_BYTES) throw new Error(`${label} 문서가 너무 커요 (${Math.round(bytes / 1024)}KB).`)
  return bytes
}

/**
 * 찾기 탭 캐시를 쓴다.
 *   events/{sidoKey}: 앞으로 90일 행사 코스 (merge — 8단계 C 파이프라인이 trendCourses 를 더한다)
 *   places/{sidoKey}: 즉석 조합용 장소 목록 (압축 문자열)
 * 문서가 크므로 지역마다 따로 쓴다.
 */
export async function uploadSearchCache(db, week, events, places) {
  let bytes = 0
  for (const [sido, courses] of Object.entries(events.bySido)) {
    const data = { sido, sidoKey: sidoKey(sido), weekId: week.weekId, range: events.range, courses, generatedAt: FieldValue.serverTimestamp() }
    bytes += checkSize(`events/${sido}`, data)
    await db.doc(`events/${sidoKey(sido)}`).set(data, { merge: true })
  }
  for (const [sido, lists] of Object.entries(places)) {
    const data = { sido, sidoKey: sidoKey(sido), weekId: week.weekId, ...lists, generatedAt: FieldValue.serverTimestamp() }
    bytes += checkSize(`places/${sido}`, data)
    await db.doc(`places/${sidoKey(sido)}`).set(data)
  }
  return bytes
}

/**
 * C 파이프라인 트렌드 코스를 합친다.
 *   coursePool/{weekId}_{sidoKey}.trendCourses — 그 주 추천 후보 (A 코스는 건드리지 않음)
 *   events/{sidoKey}.trendCourses — 기간 한정 트렌드를 찾기 탭에서도 (지난 주차 것 중 끝나지 않은 것은 유지)
 */
export async function uploadTrends(db, weekId, courses, today) {
  const bySido = {}
  for (const c of courses) (bySido[c.sido] ??= []).push(c)

  const batch = db.batch()
  for (const { name } of SIDO) {
    const key = sidoKey(name)
    batch.set(
      db.doc(`coursePool/${weekId}_${key}`),
      { weekId, sido: name, sidoKey: key, trendCourses: bySido[name] ?? [], trendsAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
  }
  await batch.commit()

  const windowEnd = addDays(today, 90)
  let eventCount = 0
  for (const { name } of SIDO) {
    const ref = db.doc(`events/${sidoKey(name)}`)
    const existing = (await ref.get()).data()?.trendCourses ?? []
    const keep = existing.filter((c) => c.weekId !== weekId && c.period?.end >= today)
    const add = (bySido[name] ?? []).filter((c) => c.period && c.period.end >= today && c.period.start <= windowEnd)
    const trendCourses = [...keep, ...add]
    eventCount += trendCourses.length
    if (existing.length || trendCourses.length) await ref.set({ trendCourses }, { merge: true })
  }
  return { poolDocs: SIDO.length, eventCount }
}

/** 보관 기간이 지난 주차의 풀을 지운다. 지운 문서 수를 돌려준다. */
export async function deleteOldPools(db, week) {
  const cutoff = weeksBefore(week.weekId, KEEP_WEEKS)
  const snap = await db.collection('coursePool').where('weekId', '<', cutoff).get()
  if (snap.empty) return 0
  const batch = db.batch()
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
  return snap.size
}
