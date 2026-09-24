import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { sidoKey } from '../../web/src/regions.js'
import { weeksBefore } from './week.js'

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
