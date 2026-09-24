import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase.js'
import { kstDate } from './shared/week.js'

// couples/{coupleId}/diary/{entryId}
//   date: 'YYYY-MM-DD' (필수), title, memo, rating(1~5|null), cost(원|null)
//   places: [{ name, address, lat, lng, contentId?, kakaoId? }]
//     contentId 가 있으면 이번 주 추천에서 그 장소를 뺀다 (weeklyRecs.js)
//   courseId, courseTitle: "다녀왔어요"로 연결된 추천 코스
//   authorUid, authorName, createdAt, updatedAt

export function diaryCollection(coupleId) {
  return collection(db, 'couples', coupleId, 'diary')
}

/** 다이어리 전체를 실시간으로 (최신 날짜 먼저). undefined = 불러오는 중 */
export function useDiaryEntries(coupleId) {
  const [state, setState] = useState({ coupleId, entries: undefined, error: null })
  useEffect(
    () =>
      onSnapshot(
        query(diaryCollection(coupleId), orderBy('date', 'desc')),
        (snap) => setState({ coupleId, entries: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: null }),
        (error) => {
          console.error(error)
          setState({ coupleId, entries: [], error })
        },
      ),
    [coupleId],
  )
  return state.coupleId === coupleId ? state : { entries: undefined, error: null }
}

/** 빈 기록, 또는 추천 코스로 미리 채운 기록 */
export function newEntry(course) {
  return {
    date: kstDate(),
    title: course?.title ?? '',
    memo: '',
    rating: null,
    cost: null,
    places: (course?.stops ?? []).map((s) => ({
      name: s.name,
      address: s.addr ?? '',
      lat: s.lat,
      lng: s.lng,
      ...(s.contentId ? { contentId: s.contentId } : {}),
    })),
    courseId: course?.id ?? null,
    courseTitle: course?.title ?? null,
  }
}

/**
 * 저장. 오프라인이어도 화면을 바로 넘길 수 있게 쓰기를 기다리지 않고 id 를 돌려준다
 * (Firestore 가 로컬에 먼저 반영하고 연결되면 올린다). 실패는 onError 로.
 */
export function saveEntry(coupleId, id, entry, user, onError) {
  const ref = id ? doc(diaryCollection(coupleId), id) : doc(diaryCollection(coupleId))
  const data = {
    date: entry.date,
    title: entry.title.trim(),
    memo: entry.memo.trim(),
    rating: entry.rating ?? null,
    cost: entry.cost ?? null,
    places: entry.places,
    courseId: entry.courseId ?? null,
    courseTitle: entry.courseTitle ?? null,
    updatedAt: serverTimestamp(),
    ...(id ? {} : { authorUid: user.uid, authorName: user.displayName || '', createdAt: serverTimestamp() }),
  }
  setDoc(ref, data, { merge: true }).catch(onError)
  return ref.id
}

export function deleteEntry(coupleId, id) {
  return deleteDoc(doc(diaryCollection(coupleId), id))
}

/** 같은 장소를 묶는 키 (지도 핀) */
export function placeKey(p) {
  if (p.kakaoId) return `k:${p.kakaoId}`
  if (p.contentId) return `t:${p.contentId}`
  return `${p.name}@${p.lat.toFixed(4)},${p.lng.toFixed(4)}`
}

/** 제목이 비었으면 장소 이름으로 */
export function entryTitle(e) {
  return e.title || e.places?.[0]?.name || '데이트'
}
