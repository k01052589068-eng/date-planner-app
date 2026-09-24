import { createContext, useContext, useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase.js'

const CoupleContext = createContext(null)

/**
 * users/{uid}.coupleId 로 내 커플 공간을 찾아 실시간 구독한다.
 * couple: undefined = 불러오는 중, null = 공간 없음, 객체 = { id, members, memberInfo, ... }
 */
export function CoupleProvider({ user, children }) {
  const [coupleId, setCoupleId] = useState(undefined)
  const [loaded, setLoaded] = useState({ id: undefined, couple: undefined })

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => setCoupleId(snap.data()?.coupleId ?? null),
        (e) => {
          console.error(e)
          setCoupleId(null)
        },
      ),
    [user.uid],
  )

  useEffect(() => {
    if (!coupleId) return
    return onSnapshot(
      doc(db, 'couples', coupleId),
      (snap) => {
        const data = snap.data()
        const couple = data?.members.includes(user.uid) ? { id: snap.id, ...data } : null
        setLoaded({ id: coupleId, couple })
      },
      (e) => {
        // 구성원이 아니면 permission-denied — 공간 없음으로 처리
        console.error(e)
        setLoaded({ id: coupleId, couple: null })
      },
    )
  }, [coupleId, user.uid])

  let couple
  if (coupleId === null) couple = null
  else if (coupleId && loaded.id === coupleId) couple = loaded.couple

  const partnerId = couple?.members.find((id) => id !== user.uid) ?? null
  const value = {
    user,
    couple,
    partner: partnerId ? { uid: partnerId, ...couple.memberInfo?.[partnerId] } : null,
  }
  return <CoupleContext.Provider value={value}>{children}</CoupleContext.Provider>
}

export function useCouple() {
  return useContext(CoupleContext)
}
