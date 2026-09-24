import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { isNoveltyWeek, recommend } from '../../web/src/shared/recommend.js'
import { sidosNear } from '../../web/src/shared/regions.js'

const SONGDO = { lat: 37.39, lng: 126.64 }
// 위도 0.01도 ≈ 1.1km
const course = (id, { km = 5, themes = ['자연·산책'], kind = 'regular', source = 'A', name = id } = {}) => ({
  id,
  kind,
  source,
  themes,
  lat: SONGDO.lat + km / 111,
  lng: SONGDO.lng,
  stops: [{ contentId: `m-${id}`, name }],
})
const settings = (over) => ({ base: SONGDO, radiusKm: 30, themes: [], recCount: 5, ...over })

describe('추천', () => {
  test('반경 안에서 개수만큼, 같은 시드면 같은 결과', () => {
    const courses = Array.from({ length: 20 }, (_, i) => course(`c${i}`, { km: i * 3 })) // 0~57km
    const a = recommend({ courses, settings: settings(), seed: 'couple:2026-W39' })
    const b = recommend({ courses, settings: settings(), seed: 'couple:2026-W39' })
    assert.equal(a.length, 5)
    assert.deepEqual(a, b)
    assert.ok(a.every((c) => c.distKm <= 30))
    const other = recommend({ courses, settings: settings(), seed: 'couple:2026-W40' })
    assert.notDeepEqual(a.map((c) => c.id), other.map((c) => c.id))
  })

  test('취향이 맞는 코스를 먼저 고른다', () => {
    const courses = [
      ...Array.from({ length: 6 }, (_, i) => course(`walk${i}`, { themes: ['자연·산책'] })),
      ...Array.from({ length: 3 }, (_, i) => course(`show${i}`, { themes: ['전시·공연'] })),
    ]
    const picks = recommend({ courses, settings: settings({ themes: ['전시·공연'], recCount: 3 }), seed: 's' })
    assert.deepEqual(picks.map((c) => c.themes[0]), ['전시·공연', '전시·공연', '전시·공연'])
  })

  test('최근 추천·다이어리 장소는 빼고, 같은 장소는 한 번만', () => {
    const courses = [course('a'), course('b'), course('b-dup', { name: 'b' }), course('c')]
    courses[2].stops[0].contentId = 'm-b' // 같은 메인 장소
    const picks = recommend({ courses, settings: settings(), seed: 's', excludeMainIds: new Set(['m-a']) })
    assert.deepEqual(picks.map((c) => c.id).sort(), ['b', 'c'])
  })

  test('이번 주 한정 행사는 가점이 있지만 절반을 넘지 않는다', () => {
    const courses = [
      ...Array.from({ length: 6 }, (_, i) => course(`ev${i}`, { kind: 'irregular', themes: [`t${i}`] })),
      ...Array.from({ length: 6 }, (_, i) => course(`reg${i}`, { themes: [`r${i}`] })),
    ]
    const picks = recommend({ courses, settings: settings({ recCount: 5 }), seed: 's' })
    assert.equal(picks.filter((c) => c.kind === 'irregular').length, 3)
  })

  test('새로운 시도 주에는 하나를 반경 밖(적당한 거리)에서 고른다', () => {
    const courses = [
      ...Array.from({ length: 8 }, (_, i) => course(`near${i}`, { km: 5, themes: [`t${i}`] })),
      course('outside', { km: 50 }),
      course('too-far', { km: 200 }),
    ]
    const picks = recommend({ courses, settings: settings({ recCount: 4 }), seed: 's', noveltyDue: true })
    assert.equal(picks.length, 4)
    const novel = picks.filter((c) => c.novel)
    assert.deepEqual(novel.map((c) => c.id), ['outside'])
  })

  test('새로운 시도: 반경 안의 고르지 않은 취향도 후보', () => {
    const courses = [...Array.from({ length: 5 }, (_, i) => course(`walk${i}`)), course('show', { themes: ['전시·공연'] })]
    const picks = recommend({ courses, settings: settings({ themes: ['자연·산책'], recCount: 3 }), seed: 's', noveltyDue: true })
    assert.equal(picks.find((c) => c.novel)?.id, 'show')
  })

  test('반경 안 코스가 모자라면 가까운 순으로 채운다', () => {
    const courses = [course('in', { km: 5 }), course('out1', { km: 40 }), course('out2', { km: 80 })]
    const picks = recommend({ courses, settings: settings({ radiusKm: 10, recCount: 3 }), seed: 's' })
    assert.deepEqual(picks.map((c) => c.id), ['in', 'out1', 'out2'])
  })

  test('새로운 시도 주기: 4주마다면 4주 중 한 번', () => {
    const weeks = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']
    assert.equal(weeks.filter((w) => isNoveltyWeek(w, 'couple', 4)).length, 2)
    assert.equal(weeks.filter((w) => isNoveltyWeek(w, 'couple', 1)).length, 8)
    assert.equal(weeks.filter((w) => isNoveltyWeek(w, 'couple', 0)).length, 0)
  })
})

describe('기준 위치 주변 지역', () => {
  test('송도 30km: 인천·경기·서울만', () => {
    assert.deepEqual(sidosNear(SONGDO, 30).sort(), ['경기', '서울', '인천'].sort())
  })

  test('전국이면 모든 지역', () => {
    assert.equal(sidosNear(SONGDO, Infinity).length, 16)
  })
})
