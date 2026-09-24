import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase.js'

// 헷갈리는 글자(0·O, 1·I·L)는 뺀 31자. firestore.rules 의 정규식과 맞춰야 한다.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6
const INVITE_TTL_MS = 24 * 60 * 60 * 1000

// 연결 해제·합류로 공간을 옮길 때 내 몫으로 복사해 가는 하위 컬렉션 (둘 다 사본 보관 정책)
const COLLECTIONS_TO_COPY = ['diary']

export class CoupleError extends Error {}

export function normalizeCode(input) {
  return (input || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isInviteActive(invite) {
  return !!invite && !invite.used && invite.expiresAt.toMillis() > Date.now()
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

function memberInfoOf(user) {
  return { name: user.displayName || '이름 없음', photoURL: user.photoURL || null }
}

function newSpace(user, settings) {
  const ref = doc(collection(db, 'couples'))
  const data = {
    members: [user.uid],
    memberInfo: { [user.uid]: memberInfoOf(user) },
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  }
  if (settings) data.settings = settings
  return { ref, data }
}

/** 나 혼자인 새 커플 공간을 만들고 내 공간으로 지정한다. */
export async function createCouple(user) {
  const { ref, data } = newSpace(user)
  const batch = writeBatch(db)
  batch.set(ref, data)
  batch.set(doc(db, 'users', user.uid), { coupleId: ref.id }, { merge: true })
  await batch.commit()
  return ref.id
}

/** 24시간 유효한 1회용 초대 코드를 만든다. 코드는 invites/{code} 문서 ID다. */
export async function createInvite(user, coupleId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    const inviteRef = doc(db, 'invites', code)
    const expiresAt = Timestamp.fromMillis(Date.now() + INVITE_TTL_MS)
    const created = await runTransaction(db, async (tx) => {
      const snap = await tx.get(inviteRef)
      if (snap.exists() && isInviteActive(snap.data())) return false // 다른 커플이 쓰는 중인 코드
      tx.set(inviteRef, { coupleId, createdBy: user.uid, createdAt: serverTimestamp(), expiresAt, used: false })
      tx.update(doc(db, 'couples', coupleId), { invite: { code, expiresAt } })
      return true
    })
    if (created) return code
  }
  throw new CoupleError('초대 코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
}

/**
 * 초대 코드로 상대 공간에 합류한다.
 * 이미 혼자 쓰던 공간(currentCoupleId)이 있으면 그 기록을 새 공간으로 복사하고 빠져나온다.
 */
export async function joinWithCode(user, rawCode, currentCoupleId = null) {
  const code = normalizeCode(rawCode)
  if (code.length !== CODE_LENGTH) throw new CoupleError('초대 코드 6자리를 입력해 주세요.')

  const inviteRef = doc(db, 'invites', code)
  let coupleId
  try {
    coupleId = await runTransaction(db, async (tx) => {
      const snap = await tx.get(inviteRef)
      if (!snap.exists()) throw new CoupleError('코드를 찾을 수 없어요. 다시 확인해 주세요.')
      const invite = snap.data()
      if (invite.createdBy === user.uid || invite.coupleId === currentCoupleId) {
        throw new CoupleError('내가 만든 초대 코드예요. 상대에게 보내 주세요.')
      }
      if (invite.used) throw new CoupleError('이미 사용된 코드예요. 상대에게 새 코드를 받아 주세요.')
      if (invite.expiresAt.toMillis() <= Date.now()) throw new CoupleError('만료된 코드예요. 상대에게 새 코드를 받아 주세요.')

      tx.update(doc(db, 'couples', invite.coupleId), {
        members: arrayUnion(user.uid),
        [`memberInfo.${user.uid}`]: memberInfoOf(user),
        joinedWithInvite: code,
        invite: deleteField(),
      })
      tx.update(inviteRef, { used: true, usedBy: user.uid, usedAt: serverTimestamp() })
      tx.set(doc(db, 'users', user.uid), { coupleId: invite.coupleId }, { merge: true })
      return invite.coupleId
    })
  } catch (e) {
    if (e instanceof CoupleError) throw e
    if (e.code === 'permission-denied') {
      throw new CoupleError('합류할 수 없는 코드예요. 이미 두 사람이 연결된 공간일 수 있어요.')
    }
    throw e
  }

  if (currentCoupleId) {
    await copyCollections(currentCoupleId, coupleId)
    await updateDoc(doc(db, 'couples', currentCoupleId), { members: arrayRemove(user.uid) })
  }
  return coupleId
}

/**
 * 연결 해제: 나는 기록 사본과 설정을 가지고 새 공간으로 옮기고, 상대는 원래 공간에 그대로 남는다.
 */
export async function leaveCouple(user, couple) {
  const { ref, data } = newSpace(user, couple.settings)
  await setDoc(ref, data)
  await copyCollections(couple.id, ref.id)

  const batch = writeBatch(db)
  batch.update(doc(db, 'couples', couple.id), { members: arrayRemove(user.uid) })
  batch.set(doc(db, 'users', user.uid), { coupleId: ref.id }, { merge: true })
  await batch.commit()
  return ref.id
}

async function copyCollections(fromId, toId) {
  for (const name of COLLECTIONS_TO_COPY) {
    const snap = await getDocs(collection(db, 'couples', fromId, name))
    // 일괄 쓰기는 500건 제한
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db)
      for (const d of snap.docs.slice(i, i + 400)) batch.set(doc(db, 'couples', toId, name, d.id), d.data())
      await batch.commit()
    }
  }
}
