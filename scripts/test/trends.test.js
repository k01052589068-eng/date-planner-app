import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { decodePlace, encodePlace } from '../../web/src/shared/compose.js'
import { enrichWithFood, validateTrends } from '../lib/trends.js'

const popup = (over = {}) => ({
  kind: 'irregular',
  title: '성수 가을 팝업스토어',
  summary: '한정 굿즈와 포토존',
  themes: ['전시·공연'],
  sido: '서울',
  sigungu: '성동구',
  period: { start: '2026-09-25', end: '2026-10-12' },
  stops: [{ name: '성수 팝업 공간', lat: 37.5445, lng: 127.0557, addr: '서울 성동구 연무장길' }],
  sources: ['https://news.example.com/a', 'https://blog.example.com/b'],
  ...over,
})
const file = (courses) => ({ weekId: '2026-W39', courses })

describe('트렌드 파일 검증', () => {
  test('정상 파일은 C 코스로 정리된다', () => {
    const { courses, errors, warnings } = validateTrends(file([popup()]), '2026-W39')
    assert.deepEqual(errors, [])
    assert.deepEqual(warnings, [])
    const [c] = courses
    assert.equal(c.id, '2026-W39-C-001')
    assert.equal(c.source, 'C')
    assert.equal(c.weekId, '2026-W39')
    assert.equal(c.stops[0].type, 'event')
    assert.equal(c.lat, 37.5445)
  })

  test('출처·좌표·테마·기간이 없거나 틀리면 오류', () => {
    const cases = [
      [{ sources: [] }, '출처'],
      [{ stops: [{ name: '어딘가' }] }, '좌표'],
      [{ themes: ['쇼핑'] }, 'themes'],
      [{ period: { start: '2026-08-01', end: '2026-09-01' } }, '이미 끝난'],
      [{ period: { start: '2027-03-01', end: '2027-03-10' } }, '90일'],
      [{ period: { start: '2026-10-10', end: '2026-10-01' } }, '늦어요'],
      [{ period: null }, 'period'],
      [{ sido: '어딘가', stops: [{ name: 'x', lat: 37.5, lng: 127, addr: '' }] }, 'sido'],
    ]
    for (const [over, word] of cases) {
      const { errors } = validateTrends(file([popup(over)]), '2026-W39')
      assert.ok(errors.some((e) => e.includes(word)), `${word}: ${errors.join(' / ')}`)
    }
  })

  test('파일 이름과 weekId 가 다르면 오류, 출처 1개는 경고', () => {
    assert.ok(validateTrends(file([popup()]), '2026-W40').errors.some((e) => e.includes('weekId')))
    const { errors, warnings } = validateTrends(file([popup({ sources: ['https://a.example.com'] })]), '2026-W39')
    assert.deepEqual(errors, [])
    assert.equal(warnings.length, 1)
  })

  test('상시 트렌드(맛집 등)는 period 없이', () => {
    const { courses, errors } = validateTrends(file([popup({ kind: 'regular', period: null, themes: ['맛집·카페'] })]), '2026-W39')
    assert.deepEqual(errors, [])
    assert.equal(courses[0].period, null)
    assert.equal(courses[0].stops[0].type, 'place')
  })
})

describe('주변 식사·카페 보강', () => {
  const near = (id, lcls, dLat) =>
    decodePlace(encodePlace({ contentId: id, name: id, lat: 37.5445 + dLat, lng: 127.0557, sigungu: '성동구', lcls, image: '' }), '서울')

  test('메인만 있으면 A 규칙으로 식사·카페를 붙이고, 원래 정보는 유지', () => {
    const { courses } = validateTrends(file([popup()]), '2026-W39')
    const places = [near('밥집', 'FD010100', 0.003), near('카페', 'FD050100', 0.002)]
    const [c] = enrichWithFood(courses, { 서울: places })
    assert.deepEqual(c.stops.map((s) => [s.type, s.name]), [
      ['event', '성수 팝업 공간'],
      ['meal', '밥집'],
      ['cafe', '카페'],
    ])
    assert.equal(c.title, '성수 가을 팝업스토어')
    assert.equal(c.source, 'C')
  })

  test('주변에 먹을 곳이 없으면 그대로', () => {
    const { courses } = validateTrends(file([popup()]), '2026-W39')
    assert.equal(enrichWithFood(courses, { 서울: [] })[0].stops.length, 1)
  })
})
