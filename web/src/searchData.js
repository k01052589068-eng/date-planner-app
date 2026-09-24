import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase.js'
import { decodePlace } from './shared/compose.js'
import { sidoKey } from './shared/regions.js'

// 한 번 받은 문서는 앱을 켜 둔 동안 다시 받지 않는다 (캐시는 주 1회만 바뀐다)
const memo = new Map()

function getOnce(path) {
  if (!memo.has(path)) {
    const p = getDoc(doc(db, path)).then((s) => (s.exists() ? s.data() : null))
    p.catch(() => memo.delete(path)) // 실패하면 다음에 다시 시도
    memo.set(path, p)
  }
  return memo.get(path)
}

/** 지역들의 행사 캐시·장소 캐시·이번 주 풀을 받아 합친다. */
export async function loadSearchData(sidos, weekId) {
  const parts = await Promise.all(
    sidos.map(async (name) => {
      const key = sidoKey(name)
      const [events, places, pool] = await Promise.all([
        getOnce(`events/${key}`),
        getOnce(`places/${key}`),
        getOnce(`coursePool/${weekId}_${key}`),
      ])
      return {
        // trendCourses: 8단계 C 파이프라인이 더할 코스
        events: [...(events?.courses ?? []), ...(events?.trendCourses ?? [])],
        places: [...(places?.main ?? []), ...(places?.food ?? [])].map((line) => decodePlace(line, name)),
        pool: [...(pool?.courses ?? []), ...(pool?.trendCourses ?? [])],
      }
    }),
  )
  return {
    events: parts.flatMap((p) => p.events),
    places: parts.flatMap((p) => p.places),
    pool: parts.flatMap((p) => p.pool),
  }
}
