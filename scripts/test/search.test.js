import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { decodePlace, encodePlace } from '../../web/src/shared/compose.js'
import { searchCourses } from '../../web/src/shared/search.js'

const SONGDO = { lat: 37.39, lng: 126.64 }
const at = (km) => ({ lat: SONGDO.lat + km / 111, lng: SONGDO.lng })

const place = (id, lcls, km, extra = {}) =>
  decodePlace(
    encodePlace({
      contentId: id,
      name: id,
      ...at(km),
      sigungu: '연수구',
      lcls,
      image: 'https://tong.visitkorea.or.kr/cms/resource/1/a.jpg',
      ...extra,
    }),
    '인천',
  )

const event = (id, km, start, end, themes = ['축제·시즌 이벤트']) => ({
  id,
  kind: 'irregular',
  themes,
  sido: '인천',
  ...at(km),
  period: { start, end },
  stops: [{ contentId: `m-${id}`, name: id }],
})

const area = { center: SONGDO, radiusKm: 10 }
const period = { start: '2026-10-03', end: '2026-10-04' }

describe('장소 캐시 압축', () => {
  test('encode ↔ decode, 분류 규칙으로 역할이 다시 붙는다', () => {
    const p = place('서울숲', 'VE030100', 1)
    assert.equal(p.role, 'main')
    assert.deepEqual(p.themes, ['자연·산책'])
    assert.equal(p.image, 'https://tong.visitkorea.or.kr/cms/resource/1/a.jpg')
    assert.equal(place('밥집', 'FD010100', 1).food.label, '한식')
    assert.equal(decodePlace(encodePlace({ contentId: '1', name: '탭\t이름', lat: 37, lng: 127, lcls: 'X' }), '서울').name, '탭 이름')
  })
})

describe('찾기', () => {
  test('이 기간에만: 기간이 겹치고 반경 안인 행사, 가까운 순', () => {
    const events = [
      event('far', 30, '2026-10-01', '2026-10-10'),
      event('before', 2, '2026-09-01', '2026-10-02'),
      event('near', 5, '2026-10-04', '2026-10-20'),
      event('nearer', 1, '2026-10-01', '2026-10-03'),
    ]
    const { limited } = searchCourses({ events, area, period })
    assert.deepEqual(limited.map((c) => c.id), ['nearer', 'near'])
    assert.equal(limited[0].distKm, 1)
  })

  test('시·도 전체 검색은 지역으로 거르고 시작일 순', () => {
    const events = [event('b', 50, '2026-10-02', '2026-10-05'), event('a', 60, '2026-09-30', '2026-10-05')]
    const { limited } = searchCourses({ events, area: { sido: '인천' }, period })
    assert.deepEqual(limited.map((c) => c.id), ['a', 'b'])
    assert.equal(limited[0].distKm, null)
  })

  test('언제든 가능: 캐시된 장소로 즉석 조합, 주변에 먹을 곳이 있어야 한다', () => {
    const places = [
      place('공원', 'VE030100', 1),
      place('밥집', 'FD010100', 1.3),
      place('카페', 'FD050100', 1.2),
      place('먼 공원', 'VE030100', 8), // 반경 안이지만 주변에 먹을 곳 없음
      place('반경 밖', 'VE030100', 20),
    ]
    const { anytime } = searchCourses({ places, area, period })
    assert.deepEqual(anytime.map((c) => c.stops[0].name), ['공원'])
    assert.equal(anytime[0].id, 'search-공원')
    assert.deepEqual(anytime[0].stops.map((s) => s.type), ['place', 'meal', 'cafe'])
  })

  test('취향 필터와, 이번 주 풀과 즉석 조합의 중복 제거', () => {
    const places = [place('공원', 'VE030100', 1), place('미술관', 'VE070600', 1.1), place('밥집', 'FD010100', 1.2)]
    const pool = [{ id: 'pool-1', kind: 'regular', themes: ['자연·산책'], sido: '인천', ...at(1), period: null, seasonNote: '가을', stops: [{ contentId: '공원', name: '공원' }] }]
    const all = searchCourses({ places, pool, area, period })
    assert.deepEqual(all.anytime.map((c) => c.id).sort(), ['pool-1', 'search-미술관'])
    const shows = searchCourses({ places, pool, area, period, themes: ['전시·공연'] })
    assert.deepEqual(shows.anytime.map((c) => c.id), ['search-미술관'])
  })
})
