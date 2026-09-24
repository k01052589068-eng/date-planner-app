// Firestore 보안 규칙 테스트. 실행: cd tests && npm test (Java 21+ 필요, 에뮬레이터 사용)
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'

let env
const HOUR = 60 * 60 * 1000

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-date-planner',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  })
})
afterAll(() => env.cleanup())
beforeEach(() => env.clearFirestore())

const db = (uid) => env.authenticatedContext(uid).firestore()
const anon = () => env.unauthenticatedContext().firestore()

async function seed(fn) {
  await env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()))
}

function createCouple(fs, uid, id = 'c1') {
  const batch = writeBatch(fs)
  batch.set(doc(fs, 'couples', id), {
    members: [uid],
    memberInfo: { [uid]: { name: uid, photoURL: null } },
    createdBy: uid,
    createdAt: serverTimestamp(),
  })
  batch.set(doc(fs, 'users', uid), { coupleId: id }, { merge: true })
  return batch.commit()
}

function createInvite(fs, uid, coupleId, code, ttl = 24 * HOUR) {
  const expiresAt = Timestamp.fromMillis(Date.now() + ttl)
  return runTransaction(fs, async (tx) => {
    await tx.get(doc(fs, 'invites', code))
    tx.set(doc(fs, 'invites', code), { coupleId, createdBy: uid, createdAt: serverTimestamp(), expiresAt, used: false })
    tx.update(doc(fs, 'couples', coupleId), { invite: { code, expiresAt } })
  })
}

// web/src/couple.js 의 joinWithCode 와 같은 쓰기
function join(fs, uid, code) {
  return runTransaction(fs, async (tx) => {
    const invite = (await tx.get(doc(fs, 'invites', code))).data()
    tx.update(doc(fs, 'couples', invite.coupleId), {
      members: arrayUnion(uid),
      [`memberInfo.${uid}`]: { name: uid, photoURL: null },
      joinedWithInvite: code,
      invite: deleteField(),
    })
    tx.update(doc(fs, 'invites', code), { used: true, usedBy: uid, usedAt: serverTimestamp() })
    tx.set(doc(fs, 'users', uid), { coupleId: invite.coupleId }, { merge: true })
  })
}

async function seedInvite(code, data) {
  await seed((fs) =>
    setDoc(doc(fs, 'invites', code), {
      coupleId: 'c1',
      createdBy: 'alice',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + HOUR),
      used: false,
      ...data,
    }),
  )
}

describe('users', () => {
  test('내 문서만 읽고 쓸 수 있다', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users', 'alice'), { coupleId: 'x' }))
    await assertSucceeds(getDoc(doc(db('alice'), 'users', 'alice')))
    await assertFails(getDoc(doc(db('bob'), 'users', 'alice')))
    await assertFails(setDoc(doc(db('bob'), 'users', 'alice'), { coupleId: 'y' }))
    await assertFails(getDoc(doc(anon(), 'users', 'alice')))
  })
})

describe('커플 공간 생성·읽기', () => {
  test('나 혼자인 공간을 만들 수 있다', async () => {
    await assertSucceeds(createCouple(db('alice'), 'alice'))
    await assertSucceeds(getDoc(doc(db('alice'), 'couples', 'c1')))
  })

  test('다른 사람을 넣어서 만들 수 없다', async () => {
    await assertFails(
      setDoc(doc(db('alice'), 'couples', 'c1'), {
        members: ['alice', 'bob'],
        memberInfo: { alice: {} },
        createdBy: 'alice',
        createdAt: serverTimestamp(),
      }),
    )
    await assertFails(
      setDoc(doc(db('alice'), 'couples', 'c1'), {
        members: ['bob'],
        memberInfo: { bob: {} },
        createdBy: 'bob',
        createdAt: serverTimestamp(),
      }),
    )
  })

  test('구성원이 아니면 읽을 수 없다', async () => {
    await createCouple(db('alice'), 'alice')
    await assertFails(getDoc(doc(db('mallory'), 'couples', 'c1')))
  })
})

describe('초대 코드', () => {
  beforeEach(() => createCouple(db('alice'), 'alice'))

  test('구성원은 초대 코드를 만들 수 있다', async () => {
    await assertSucceeds(createInvite(db('alice'), 'alice', 'c1', 'ABC234'))
  })

  test('구성원이 아니면 그 공간의 초대 코드를 만들 수 없다', async () => {
    await assertFails(
      setDoc(doc(db('mallory'), 'invites', 'ABC234'), {
        coupleId: 'c1',
        createdBy: 'mallory',
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + HOUR),
        used: false,
      }),
    )
  })

  test('24시간보다 긴 코드, 형식이 틀린 코드는 만들 수 없다', async () => {
    await assertFails(createInvite(db('alice'), 'alice', 'c1', 'ABC234', 48 * HOUR))
    await assertFails(createInvite(db('alice'), 'alice', 'c1', 'ABC230')) // 0 은 쓰지 않는 글자
  })

  test('코드 하나는 조회할 수 있지만 목록은 볼 수 없다', async () => {
    await createInvite(db('alice'), 'alice', 'c1', 'ABC234')
    await assertSucceeds(getDoc(doc(db('bob'), 'invites', 'ABC234')))
    await assertFails(getDocs(collection(db('bob'), 'invites')))
    await assertFails(getDoc(doc(anon(), 'invites', 'ABC234')))
  })

  test('사용 중인 코드 자리는 덮어쓸 수 없고, 만료된 자리는 덮어쓸 수 있다', async () => {
    await createCouple(db('carol'), 'carol', 'c2')
    await createInvite(db('alice'), 'alice', 'c1', 'ABC234')
    await assertFails(createInvite(db('carol'), 'carol', 'c2', 'ABC234'))
    await seedInvite('XYZ234', { expiresAt: Timestamp.fromMillis(Date.now() - HOUR) })
    await assertSucceeds(createInvite(db('carol'), 'carol', 'c2', 'XYZ234'))
  })
})

describe('합류', () => {
  beforeEach(async () => {
    await createCouple(db('alice'), 'alice')
    await createInvite(db('alice'), 'alice', 'c1', 'ABC234')
  })

  test('유효한 코드로 합류할 수 있고, 이후 공간을 읽을 수 있다', async () => {
    await assertSucceeds(join(db('bob'), 'bob', 'ABC234'))
    const snap = await getDoc(doc(db('bob'), 'couples', 'c1'))
    expect(snap.data().members).toEqual(['alice', 'bob'])
    expect(snap.data().invite).toBeUndefined()
  })

  test('코드를 사용 처리하지 않고 구성원에 끼어들 수 없다', async () => {
    await assertFails(
      updateDoc(doc(db('bob'), 'couples', 'c1'), {
        members: arrayUnion('bob'),
        joinedWithInvite: 'ABC234',
        invite: deleteField(),
      }),
    )
  })

  test('합류하지 않고 코드만 사용 처리할 수 없다', async () => {
    await assertFails(updateDoc(doc(db('bob'), 'invites', 'ABC234'), { used: true, usedBy: 'bob', usedAt: serverTimestamp() }))
  })

  test('사용된 코드, 만료된 코드로는 합류할 수 없다', async () => {
    await seedInvite('USED23', { used: true, usedBy: 'someone' })
    await assertFails(join(db('bob'), 'bob', 'USED23'))
    await seedInvite('OLD234', { expiresAt: Timestamp.fromMillis(Date.now() - 1000) })
    await assertFails(join(db('bob'), 'bob', 'OLD234'))
  })

  test('다른 공간의 코드를 끼워서 합류할 수 없다', async () => {
    await createCouple(db('mallory'), 'mallory', 'c2')
    await createInvite(db('mallory'), 'mallory', 'c2', 'MXP234')
    const fs = db('bob')
    await assertFails(
      runTransaction(fs, async (tx) => {
        tx.update(doc(fs, 'couples', 'c1'), {
          members: arrayUnion('bob'),
          joinedWithInvite: 'MXP234',
          invite: deleteField(),
        })
        tx.update(doc(fs, 'invites', 'MXP234'), { used: true, usedBy: 'bob', usedAt: serverTimestamp() })
      }),
    )
  })

  test('두 명이 찬 공간에는 세 번째 사람이 합류할 수 없다', async () => {
    await createInvite(db('alice'), 'alice', 'c1', 'SEC234')
    await join(db('bob'), 'bob', 'ABC234')
    await assertFails(join(db('carol'), 'carol', 'SEC234'))
  })

  test('내가 만든 코드로 내 공간에 다시 합류할 수 없다', async () => {
    await assertFails(join(db('alice'), 'alice', 'ABC234'))
  })
})

describe('구성원 수정·연결 해제', () => {
  beforeEach(async () => {
    await createCouple(db('alice'), 'alice')
    await createInvite(db('alice'), 'alice', 'c1', 'ABC234')
    await join(db('bob'), 'bob', 'ABC234')
  })

  test('설정은 둘 다 바꿀 수 있다', async () => {
    await assertSucceeds(updateDoc(doc(db('alice'), 'couples', 'c1'), { settings: { radius: 30 } }))
    await assertSucceeds(updateDoc(doc(db('bob'), 'couples', 'c1'), { settings: { radius: 50 } }))
    await assertFails(updateDoc(doc(db('mallory'), 'couples', 'c1'), { settings: { radius: 10 } }))
  })

  test('구성원 목록과 상대의 프로필은 바꿀 수 없다', async () => {
    await assertFails(updateDoc(doc(db('alice'), 'couples', 'c1'), { members: ['alice'] }))
    await assertFails(updateDoc(doc(db('alice'), 'couples', 'c1'), { members: ['alice', 'bob', 'carol'] }))
    await assertFails(updateDoc(doc(db('alice'), 'couples', 'c1'), { 'memberInfo.bob.name': '바꿈' }))
    await assertSucceeds(updateDoc(doc(db('alice'), 'couples', 'c1'), { 'memberInfo.alice.name': '앨리스' }))
  })

  test('나만 빠져나갈 수 있고, 상대를 내보낼 수는 없다', async () => {
    await assertFails(updateDoc(doc(db('alice'), 'couples', 'c1'), { members: arrayRemove('bob') }))
    await assertSucceeds(updateDoc(doc(db('bob'), 'couples', 'c1'), { members: arrayRemove('bob') }))
    await assertFails(getDoc(doc(db('bob'), 'couples', 'c1')))
  })

  test('공간은 삭제할 수 없다', async () => {
    await assertFails(deleteDoc(doc(db('alice'), 'couples', 'c1')))
  })
})

describe('하위 컬렉션 (다이어리 등)', () => {
  beforeEach(async () => {
    await createCouple(db('alice'), 'alice')
    await createInvite(db('alice'), 'alice', 'c1', 'ABC234')
    await join(db('bob'), 'bob', 'ABC234')
  })

  test('구성원만 읽고 쓸 수 있다', async () => {
    const entry = doc(db('alice'), 'couples', 'c1', 'diary', 'd1')
    await assertSucceeds(setDoc(entry, { title: '첫 데이트' }))
    await assertSucceeds(getDoc(doc(db('bob'), 'couples', 'c1', 'diary', 'd1')))
    await assertFails(getDoc(doc(db('mallory'), 'couples', 'c1', 'diary', 'd1')))
    await assertFails(setDoc(doc(db('mallory'), 'couples', 'c1', 'diary', 'd2'), { title: 'x' }))
  })

  test('연결 해제 후에는 원래 공간의 기록을 볼 수 없다', async () => {
    await setDoc(doc(db('alice'), 'couples', 'c1', 'diary', 'd1'), { title: '첫 데이트' })
    await updateDoc(doc(db('bob'), 'couples', 'c1'), { members: arrayRemove('bob') })
    await assertFails(getDoc(doc(db('bob'), 'couples', 'c1', 'diary', 'd1')))
    await assertSucceeds(getDoc(doc(db('alice'), 'couples', 'c1', 'diary', 'd1')))
  })
})

describe('코스 풀·행사 캐시', () => {
  test('로그인 사용자는 읽기만 가능하다', async () => {
    await seed((fs) => setDoc(doc(fs, 'coursePool', '2026-W39_seoul'), { courses: [] }))
    await assertSucceeds(getDoc(doc(db('alice'), 'coursePool', '2026-W39_seoul')))
    await assertFails(getDoc(doc(anon(), 'coursePool', '2026-W39_seoul')))
    await assertFails(setDoc(doc(db('alice'), 'coursePool', '2026-W39_seoul'), { courses: [] }))
    await assertFails(setDoc(doc(db('alice'), 'events', 'seoul'), { items: [] }))
  })

  test('행사·장소 캐시도 로그인 사용자 읽기 전용', async () => {
    await seed(async (fs) => {
      await setDoc(doc(fs, 'events', 'seoul'), { courses: [] })
      await setDoc(doc(fs, 'places', 'seoul'), { main: [], food: [] })
    })
    for (const col of ['events', 'places']) {
      await assertSucceeds(getDoc(doc(db('alice'), col, 'seoul')))
      await assertFails(getDoc(doc(anon(), col, 'seoul')))
      await assertFails(setDoc(doc(db('alice'), col, 'seoul'), { courses: [] }))
    }
  })
})
