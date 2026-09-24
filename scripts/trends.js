// C 파이프라인 도우미. /weekly-trends 명령(.claude/commands/weekly-trends.md)과 trends-upload.yml 이 쓴다.
//
//   npm run trends -- info                         이번 주 주차·기간·계절, 트렌드 파일 경로
//   npm run trends -- geocode data/trends/2026-W40.json   좌표 없는 장소를 카카오 장소 검색으로 채움 (KAKAO_REST_KEY)
//   npm run trends -- validate data/trends/2026-W40.json  형식·기간·출처 검증 (오류가 있으면 종료 코드 1)
//   npm run trends -- upload [파일...] [--dry-run]         검증 → 주변 식사·카페 보강 → Firestore 합치기
import { access, readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { decodePlace } from '../web/src/shared/compose.js'
import { sidoKey } from '../web/src/shared/regions.js'
import { addDays, kstDate, weekOf } from '../web/src/shared/week.js'
import { searchPlace } from './lib/kakaoLocal.js'
import { enrichWithFood, validateTrends } from './lib/trends.js'
import { initFirestore, uploadTrends } from './lib/upload.js'

const ROOT = resolve(import.meta.dirname, '..')
const SEASONS = ['겨울', '겨울', '봄', '봄', '봄', '여름', '여름', '여름', '가을', '가을', '가을', '겨울']

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: { 'dry-run': { type: 'boolean', default: false } },
})
const [command, ...files] = positionals

const weekIdOf = (file) => basename(file, '.json')
const trendPath = (weekId) => resolve(ROOT, 'data/trends', `${weekId}.json`)
const readJson = async (file) => JSON.parse(await readFile(resolve(file), 'utf8'))
const exists = (file) =>
  access(file).then(
    () => true,
    () => false,
  )

function printReport(file, { courses, errors, warnings }) {
  console.log(`\n■ ${file}`)
  for (const c of courses) {
    const period = c.period ? `${c.period.start}~${c.period.end}` : '상시'
    const coords = c.stops.every((s) => Number.isFinite(s.lat)) ? '' : ' (좌표 없음)'
    console.log(`  - [${c.sido}] ${c.title} | ${period} | ${c.themes.join('/')} | 출처 ${c.sources.length}${coords}`)
  }
  for (const w of warnings) console.log(`  ⚠ ${w}`)
  for (const e of errors) console.log(`  ✖ ${e}`)
  console.log(errors.length ? `  → 오류 ${errors.length}개. 고친 뒤 다시 검증하세요.` : `  → 통과 (${courses.length}개 코스)`)
}

async function info() {
  const week = weekOf(kstDate())
  const month = Number(addDays(week.start, 3).slice(5, 7))
  const file = trendPath(week.weekId)
  console.log(`주차: ${week.weekId}`)
  console.log(`기간: ${week.start} ~ ${week.end} (월~일, KST)`)
  console.log(`계절: ${month}월 ${SEASONS[month - 1]}`)
  console.log(`기간 한정 행사 인정 범위: ${week.start} 이후 끝나고 ${addDays(week.start, 90)} 이전에 시작`)
  console.log(`파일: data/trends/${week.weekId}.json ${(await exists(file)) ? '(이미 있음)' : '(없음)'}`)
}

async function geocode(file) {
  const key = process.env.KAKAO_REST_KEY
  if (!key) throw new Error('KAKAO_REST_KEY 가 없어요. scripts/.env 에 카카오 REST API 키를 넣어 주세요.')
  const json = await readJson(file)
  let filled = 0
  for (const course of json.courses ?? []) {
    for (const stop of course.stops ?? []) {
      if (Number.isFinite(Number(stop.lat)) && Number(stop.lat) !== 0 && stop.lat !== null) continue
      const query = [course.sigungu, stop.name].filter(Boolean).join(' ')
      const [hit] = await searchPlace(query, key).then((r) => (r.length ? r : searchPlace(stop.name, key)))
      if (!hit) {
        console.log(`  ✖ 못 찾음: ${stop.name} (검색어 "${query}") — 좌표를 직접 넣거나 이름을 바꿔 주세요`)
        continue
      }
      Object.assign(stop, { lat: hit.lat, lng: hit.lng, addr: stop.addr || hit.addr })
      filled++
      console.log(`  ✔ ${stop.name} → ${hit.name} (${hit.addr}) [${hit.category}]`)
    }
  }
  await writeFile(resolve(file), `${JSON.stringify(json, null, 2)}\n`)
  console.log(`좌표 ${filled}곳 채움 → ${file}`)
}

async function validate(file) {
  const report = validateTrends(await readJson(file), weekIdOf(file))
  printReport(file, report)
  return report
}

async function upload(targets) {
  if (!targets.length) targets = [trendPath(weekOf(kstDate()).weekId)]
  const db = opts['dry-run'] && !process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS ? null : initFirestore()
  for (const file of targets) {
    const report = await validate(file)
    if (report.errors.length) throw new Error(`${file} 검증 실패 — 올리지 않았어요.`)

    // 트렌드 장소 주변 식사·카페를 붙이려고 해당 지역 장소 캐시를 읽는다
    const placesBySido = {}
    if (db) {
      for (const sido of new Set(report.courses.map((c) => c.sido))) {
        const data = (await db.doc(`places/${sidoKey(sido)}`).get()).data()
        placesBySido[sido] = [...(data?.main ?? []), ...(data?.food ?? [])].map((l) => decodePlace(l, sido))
      }
    }
    const courses = enrichWithFood(report.courses, placesBySido)
    for (const c of courses) console.log(`  · ${c.title}: ${c.stops.map((s) => s.name).join(' → ')}`)

    if (opts['dry-run']) {
      console.log('  (--dry-run: Firestore 에 쓰지 않았어요)')
      continue
    }
    const result = await uploadTrends(db, weekIdOf(file), courses, kstDate())
    console.log(`  ✔ coursePool ${result.poolDocs}개 문서에 트렌드 반영, 찾기 탭 트렌드 행사 ${result.eventCount}건`)
  }
}

try {
  if (command === 'info') await info()
  else if (command === 'geocode' && files[0]) await geocode(files[0])
  else if (command === 'validate' && files.length) {
    let failed = false
    for (const f of files) failed = (await validate(f)).errors.length > 0 || failed
    process.exitCode = failed ? 1 : 0
  } else if (command === 'upload') await upload(files)
  else {
    console.log('사용법: npm run trends -- info | geocode <파일> | validate <파일...> | upload [파일...] [--dry-run]')
    process.exitCode = 1
  }
} catch (e) {
  console.error(`✖ ${e.message}`)
  process.exitCode = 1
}
