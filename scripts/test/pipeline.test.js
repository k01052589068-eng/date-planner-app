import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { normalizeSido, sidoFromLDong } from '../../web/src/regions.js'
import { composeWeek } from '../lib/compose.js'
import { normalizePlace } from '../lib/places.js'
import { kstDate, weekFromId, weekOf, weeksBefore } from '../lib/week.js'

describe('주차', () => {
  test('월~일, ISO 주차', () => {
    assert.deepEqual(weekOf('2026-09-24'), { weekId: '2026-W39', start: '2026-09-21', end: '2026-09-27' })
    assert.deepEqual(weekOf('2026-09-27'), { weekId: '2026-W39', start: '2026-09-21', end: '2026-09-27' })
    assert.equal(weekOf('2026-09-28').weekId, '2026-W40')
  })

  test('연말연시 경계', () => {
    assert.equal(weekOf('2026-01-01').weekId, '2026-W01') // 목요일
    assert.equal(weekOf('2027-01-01').weekId, '2026-W53') // 금요일 → 전년도 53주
    assert.equal(weekOf('2025-12-29').weekId, '2026-W01')
  })

  test('주차 ID ↔ 날짜, n주 전', () => {
    assert.deepEqual(weekFromId('2026-W39'), weekOf('2026-09-21'))
    assert.equal(weeksBefore('2026-W02', 4), '2025-W50')
    assert.throws(() => weekFromId('2026-39'))
  })

  test('KST 기준: 일요일 15:00 UTC 는 한국 월요일 0시', () => {
    assert.equal(kstDate(new Date('2026-09-27T15:00:00Z')), '2026-09-28')
    assert.equal(weekOf(kstDate(new Date('2026-09-27T15:00:00Z'))).weekId, '2026-W40')
  })
})

describe('지역', () => {
  test('주소 → 표준형 (광주·전남 통합 포함)', () => {
    const cases = {
      '인천광역시 연수구 송도동': '인천',
      '경기 광주시 오포읍': '경기',
      광주광역시: '전남광주',
      '전남광주통합특별시 남구 사직길 49': '전남광주',
      '전라남도 여수시': '전남광주',
      '강원특별자치도 춘천시': '강원',
      전북특별자치도: '전북',
      세종특별자치시: '세종',
      미국: null,
    }
    for (const [addr, want] of Object.entries(cases)) assert.equal(normalizeSido(addr), want, addr)
  })

  test('법정동 코드', () => {
    assert.equal(sidoFromLDong('12'), '전남광주')
    assert.equal(sidoFromLDong('36110'), '세종')
    assert.equal(sidoFromLDong('99'), null)
  })
})

const item = (over) => ({
  contentid: '1',
  contenttypeid: '12',
  title: '장소',
  addr1: '서울특별시 성동구 뚝섬로 273',
  mapx: '127.0374',
  mapy: '37.5444',
  lDongRegnCd: '11',
  lclsSystm3: 'VE030100',
  firstimage: 'https://example.com/a.jpg',
  ...over,
})

describe('장소 분류', () => {
  test('시민공원은 자연·산책 메인', () => {
    const p = normalizePlace(item({ title: '서울숲' }))
    assert.equal(p.role, 'main')
    assert.deepEqual(p.themes, ['자연·산책'])
    assert.equal(p.sigungu, '성동구')
  })

  test('카페·식당은 식사 정류장, 주점은 제외', () => {
    assert.equal(normalizePlace(item({ lclsSystm3: 'FD050100' })).food.kind, 'cafe')
    assert.equal(normalizePlace(item({ lclsSystm3: 'FD020200' })).food.label, '일식')
    assert.equal(normalizePlace(item({ lclsSystm3: 'FD040100' })).role, null)
  })

  test('데이트에 맞지 않는 분류는 쓰지 않는다', () => {
    for (const lcls of ['VE030300', 'EX050500', 'EX061000', 'VE070400', 'AC010100']) {
      assert.equal(normalizePlace(item({ lclsSystm3: lcls })).role, null, lcls)
    }
  })

  test('주소가 법정동 코드보다 우선', () => {
    assert.equal(normalizePlace(item({ addr1: '부산광역시 수영구 광남로 96', lDongRegnCd: '52' })).sido, '부산')
  })

  test('좌표가 없으면 버린다', () => {
    assert.equal(normalizePlace(item({ mapx: '0', mapy: '0' })), null)
  })

  test('행사는 기간이 붙는다', () => {
    const p = normalizePlace(
      item({ contenttypeid: '15', lclsSystm3: 'EV010100', eventstartdate: '20260920', eventenddate: '20261005' }),
    )
    assert.deepEqual(p.period, { start: '2026-09-20', end: '2026-10-05' })
    assert.deepEqual(p.themes, ['축제·시즌 이벤트'])
  })
})

describe('코스 조합', () => {
  const week = weekFromId('2026-W39')
  const park = normalizePlace(item({ contentid: 'park', title: '서울숲 (성수)' }))
  const meal = normalizePlace(item({ contentid: 'meal', title: '밥집', lclsSystm3: 'FD010100', mapy: '37.5450' }))
  const cafe = normalizePlace(item({ contentid: 'cafe', title: '카페', lclsSystm3: 'FD050100', mapy: '37.5440' }))
  const farPark = normalizePlace(item({ contentid: 'far', title: '먼 공원', mapy: '37.70' })) // 약 17km 떨어짐
  const fest = (start, end, id) =>
    normalizePlace(
      item({ contentid: id, title: `축제${id}`, contenttypeid: '15', lclsSystm3: 'EV010100', eventstartdate: start, eventenddate: end }),
    )

  test('메인 + 주변 식사 + 카페, 제목은 괄호를 뺀 짧은 이름', () => {
    const pools = composeWeek({ week, places: [park, meal, cafe], festivals: [] })
    const [course] = pools['서울']
    assert.equal(course.id, '2026-W39-seoul-001')
    assert.equal(course.kind, 'regular')
    assert.deepEqual(
      course.stops.map((s) => [s.order, s.type, s.name]),
      [
        [1, 'place', '서울숲 (성수)'],
        [2, 'meal', '밥집'],
        [3, 'cafe', '카페'],
      ],
    )
    assert.equal(course.title, '서울숲 산책 + 한식 맛집 + 카페')
  })

  test('주변에 먹을 곳이 없는 상시 코스는 만들지 않는다', () => {
    const pools = composeWeek({ week, places: [farPark, meal], festivals: [] })
    assert.equal(pools['서울'].length, 0)
  })

  test('이번 주와 기간이 겹치는 행사만 기간 한정 코스로', () => {
    const festivals = [fest('20260901', '20260920', 'past'), fest('20260927', '20261010', 'now'), fest('20260928', '20261010', 'next')]
    const pools = composeWeek({ week, places: [meal], festivals })
    const irregular = pools['서울'].filter((c) => c.kind === 'irregular')
    assert.deepEqual(irregular.map((c) => c.stops[0].contentId), ['now'])
    assert.deepEqual(irregular[0].period, { start: '2026-09-27', end: '2026-10-10' })
  })

  test('같은 주차·지역은 항상 같은 결과', () => {
    const input = { week, places: [park, meal, cafe], festivals: [] }
    assert.deepEqual(composeWeek(input), composeWeek(input))
  })
})
