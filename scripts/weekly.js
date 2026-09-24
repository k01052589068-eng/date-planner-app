// A 파이프라인: TourAPI 수집 → 규칙 기반 코스 조합 → (선택) Firestore 업로드
//
//   npm run weekly                       이번 주 풀을 만들어 data/output/ 에 저장 (업로드 안 함)
//   npm run weekly -- --upload           만든 풀을 Firestore 에 올리고 오래된 풀 삭제
//   npm run weekly -- --week 2026-W40    특정 주차로 실행
//   npm run weekly -- --cache            오늘 받아 둔 TourAPI 응답(data/cache/)을 재사용 (개발용)
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { sidoKey } from '../web/src/regions.js'
import { composeWeek } from './lib/compose.js'
import { normalizePlace } from './lib/places.js'
import { TourApi } from './lib/tourapi.js'
import { deleteOldPools, initFirestore, uploadPools } from './lib/upload.js'
import { addDays, kstDate, toCompact, weekFromId, weekOf } from './lib/week.js'

const ROOT = new URL('../', import.meta.url)
const PLACE_TYPES = { 12: '관광지', 14: '문화시설', 28: '레포츠', 39: '음식점' }

const { values: args } = parseArgs({
  options: {
    week: { type: 'string' },
    upload: { type: 'boolean', default: false },
    cache: { type: 'boolean', default: false },
  },
})

const week = args.week ? weekFromId(args.week) : weekOf(kstDate())
const month = Number(addDays(week.start, 3).slice(5, 7)) // 그 주 목요일이 속한 달
console.log(`▶ ${week.weekId} (${week.start} ~ ${week.end}) 코스 풀 생성`)

const api = new TourApi(process.env.TOURAPI_KEY)
const cacheDir = new URL(`data/cache/${kstDate()}/`, ROOT)

/** TourAPI 결과를 받아 오되, --cache 면 오늘 받은 파일을 재사용 */
async function cached(name, fetcher) {
  const file = new URL(`${name}.json`, cacheDir)
  if (args.cache) {
    try {
      return JSON.parse(await readFile(file, 'utf8'))
    } catch {
      // 캐시가 없으면 새로 받는다
    }
  }
  const items = await fetcher()
  await mkdir(cacheDir, { recursive: true })
  await writeFile(file, JSON.stringify(items))
  return items
}

// 1) 수집
const rawPlaces = []
for (const [typeId, label] of Object.entries(PLACE_TYPES)) {
  const items = await cached(`places-${typeId}`, () => api.fetchAll('areaBasedList2', { contentTypeId: typeId, arrange: 'C' }))
  console.log(`  ${label}: ${items.length.toLocaleString()}곳`)
  rawPlaces.push(...items)
}
const rawFestivals = await cached(`festivals-${week.start}`, () =>
  api.fetchAll('searchFestival2', { eventStartDate: toCompact(week.start), arrange: 'C' }),
)
console.log(`  행사(${week.start} 이후 진행): ${rawFestivals.length}건`)

const seasons = JSON.parse(await readFile(new URL('data/templates/seasons.json', ROOT), 'utf8'))
const seasonal = new Map()
for (const { keyword, note } of seasons.months[month] ?? []) {
  const items = await cached(`keyword-${keyword}`, () => api.fetchAll('searchKeyword2', { keyword, arrange: 'C' }))
  let used = 0
  for (const item of items) {
    if (!seasonal.has(item.contentid)) {
      seasonal.set(item.contentid, note)
      used++
    }
  }
  console.log(`  계절 키워드 '${keyword}': ${used}곳`)
}
console.log(`  TourAPI 호출 ${api.calls}회`)

// 2) 정리
const byId = new Map()
for (const item of rawPlaces) {
  const p = normalizePlace(item)
  if (p) byId.set(p.contentId, p)
}
const places = [...byId.values()]
const festivals = rawFestivals.map(normalizePlace).filter((p) => p?.period)

// 3) 조합
const pools = composeWeek({ week, places, festivals, seasonal })

// 4) 저장·요약
const outDir = new URL(`data/output/${week.weekId}/`, ROOT)
await mkdir(outDir, { recursive: true })
let total = 0
const themeCount = {}
console.log('\n지역       행사  상시  예시')
for (const [sido, courses] of Object.entries(pools)) {
  await writeFile(new URL(`${sidoKey(sido)}.json`, outDir), JSON.stringify(courses, null, 2))
  total += courses.length
  for (const c of courses) for (const t of c.themes) themeCount[t] = (themeCount[t] ?? 0) + 1
  const irregular = courses.filter((c) => c.kind === 'irregular').length
  const sample = courses.find((c) => c.kind === 'regular')?.title ?? '-'
  console.log(`${sido.padEnd(8, '　')} ${String(irregular).padStart(4)}  ${String(courses.length - irregular).padStart(4)}  ${sample}`)
}
console.log(`\n총 ${total}개 코스 → data/output/${week.weekId}/`)
console.log('테마별:', Object.entries(themeCount).map(([t, n]) => `${t} ${n}`).join(', '))

// 5) 업로드
if (args.upload) {
  const db = initFirestore()
  const written = await uploadPools(db, week, pools)
  const deleted = await deleteOldPools(db, week)
  console.log(`\n✔ Firestore 업로드: coursePool 문서 ${written}개, 오래된 풀 ${deleted}개 삭제`)
} else {
  console.log('\n(업로드하지 않았어요. 올리려면 --upload)')
}
