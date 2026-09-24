import { useCallback, useState } from 'react'
import { useCouple } from '../CoupleProvider.jsx'
import Chip from '../components/Chip.jsx'
import CourseCard from '../components/CourseCard.jsx'
import PlacePicker from '../components/PlacePicker.jsx'
import { monthDay } from '../format.js'
import { loadSearchData } from '../searchData.js'
import { THEMES } from '../settings.js'
import { SIDO_LIST, sidosNear } from '../shared/regions.js'
import { searchCourses } from '../shared/search.js'
import { addDays, kstDate } from '../shared/week.js'
import { currentWeek } from '../weeklyRecs.js'

const RADIUS_CHOICES = [5, 10, 20, 50]
const MAX_DAYS_AHEAD = 90 // 행사 캐시 범위
const PAGE = 10

/** 빠른 기간 선택 */
function quickPeriods(today) {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay() // 0=일 … 6=토
  const saturday = dow === 0 ? addDays(today, -1) : addDays(today, 6 - dow)
  const thisWeekend = { start: dow === 0 ? today : saturday, end: addDays(saturday, 1) }
  return [
    { label: '이번 주말', ...thisWeekend },
    { label: '다음 주말', start: addDays(saturday, 7), end: addDays(saturday, 8) },
    { label: '2주 안', start: today, end: addDays(today, 13) },
    { label: '한 달 안', start: today, end: addDays(today, 29) },
  ]
}

// 탭을 옮겨 다녀도 마지막 검색 조건·결과를 유지한다
let saved = null

export default function Search() {
  const { couple } = useCouple()
  const base = couple.settings?.base ?? null
  const today = kstDate()
  const quick = quickPeriods(today)

  const [where, setWhere] = useState(saved?.where ?? (base ? { place: base, radiusKm: 10 } : { sido: '서울' }))
  const [period, setPeriod] = useState(saved?.period ?? { start: quick[0].start, end: quick[0].end })
  const [themes, setThemes] = useState(saved?.themes ?? [])
  const [result, setResult] = useState(saved?.result ?? null)
  const [shown, setShown] = useState({ limited: PAGE, anytime: PAGE })
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const periodInvalid = !period.start || !period.end || period.start > period.end

  async function handleSearch() {
    setBusy(true)
    setError(null)
    try {
      const area = where.place
        ? { center: { lat: where.place.lat, lng: where.place.lng }, radiusKm: where.radiusKm }
        : { sido: where.sido }
      const sidos = where.place ? sidosNear(area.center, where.radiusKm) : [where.sido]
      const data = await loadSearchData(sidos, currentWeek().weekId)
      const found = searchCourses({ ...data, area, period, themes, seed: `${couple.id}:${period.start}` })
      const next = { ...found, label: where.place ? where.place.name : where.sido }
      setResult(next)
      setShown({ limited: PAGE, anytime: PAGE })
      saved = { where, period, themes, result: next }
    } catch (e) {
      console.error(e)
      setError('검색하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const handlePick = useCallback((place) => {
    setWhere((w) => ({ place, radiusKm: w.radiusKm ?? 10 }))
    setPicking(false)
  }, [])
  const closePicker = useCallback(() => setPicking(false), [])

  function toggleTheme(t) {
    setThemes((list) => (list.includes(t) ? list.filter((x) => x !== t) : THEMES.filter((x) => x === t || list.includes(x))))
  }

  return (
    <section className="page">
      <h1>찾기</h1>

      <div className="card">
        <p className="card-label">어디서</p>
        {where.place ? (
          <div className="row">
            <p className="grow strong">📍 {where.place.name}</p>
            <button type="button" className="btn btn-small" onClick={() => setPicking(true)}>
              변경
            </button>
          </div>
        ) : (
          <select className="input" value={where.sido} onChange={(e) => setWhere({ sido: e.target.value })} aria-label="시·도">
            {SIDO_LIST.map((s) => (
              <option key={s} value={s}>
                {s} 전체
              </option>
            ))}
          </select>
        )}
        <div className="chips" role="group" aria-label="검색 범위">
          {RADIUS_CHOICES.map((km) => (
            <Chip
              key={km}
              selected={!!where.place && where.radiusKm === km}
              onClick={() => (where.place || base ? setWhere({ place: where.place ?? base, radiusKm: km }) : setPicking(true))}
            >
              {km}km
            </Chip>
          ))}
          <Chip selected={!where.place} onClick={() => setWhere({ sido: where.place?.sido || base?.sido || '서울' })}>
            시·도 전체
          </Chip>
        </div>
        {!where.place && (
          <button type="button" className="btn-link" onClick={() => setPicking(true)}>
            장소를 검색해 주변으로 찾기
          </button>
        )}
      </div>

      <div className="card">
        <p className="card-label">언제</p>
        <div className="chips" role="group" aria-label="빠른 기간 선택">
          {quick.map((q) => (
            <Chip key={q.label} selected={period.start === q.start && period.end === q.end} onClick={() => setPeriod({ start: q.start, end: q.end })}>
              {q.label}
            </Chip>
          ))}
        </div>
        <div className="date-range">
          <input
            type="date"
            className="input"
            value={period.start}
            min={today}
            max={addDays(today, MAX_DAYS_AHEAD)}
            onChange={(e) => setPeriod((p) => ({ ...p, start: e.target.value }))}
            aria-label="시작일"
          />
          <span className="muted">~</span>
          <input
            type="date"
            className="input"
            value={period.end}
            min={period.start || today}
            max={addDays(today, MAX_DAYS_AHEAD)}
            onChange={(e) => setPeriod((p) => ({ ...p, end: e.target.value }))}
            aria-label="종료일"
          />
        </div>
        {periodInvalid && <p className="error">종료일이 시작일보다 빠르지 않게 골라 주세요.</p>}
      </div>

      <div className="card">
        <p className="card-label">취향 (선택)</p>
        <div className="chips" role="group" aria-label="취향">
          {THEMES.map((t) => (
            <Chip key={t} selected={themes.includes(t)} onClick={() => toggleTheme(t)}>
              {t}
            </Chip>
          ))}
        </div>
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={handleSearch} disabled={busy || periodInvalid}>
        {busy ? '찾는 중…' : '찾기'}
      </button>
      {error && <p className="error">{error}</p>}

      {result && (
        <div className="search-results">
          <ResultSection
            title="이 기간에만"
            hint={`${monthDay(period.start)} ~ ${monthDay(period.end)}에 열리는 행사`}
            empty="이 기간에 열리는 행사를 찾지 못했어요. 범위나 기간을 넓혀 보세요."
            courses={result.limited}
            shown={shown.limited}
            onMore={() => setShown((s) => ({ ...s, limited: s.limited + PAGE }))}
            distanceFrom={result.label}
          />
          <ResultSection
            title="언제든 가능"
            hint="상시 가볼 수 있는 코스"
            empty="조건에 맞는 코스를 찾지 못했어요. 범위를 넓히거나 취향을 줄여 보세요."
            courses={result.anytime}
            shown={shown.anytime}
            onMore={() => setShown((s) => ({ ...s, anytime: s.anytime + PAGE }))}
            distanceFrom={result.label}
          />
        </div>
      )}

      {picking && <PlacePicker title="어디 주변에서 찾을까요?" onSelect={handlePick} onClose={closePicker} />}
    </section>
  )
}

function ResultSection({ title, hint, empty, courses, shown, onMore, distanceFrom }) {
  return (
    <section className="result-section">
      <h2 className="section-title">
        {title} <span className="count">{courses.length}</span>
      </h2>
      <p className="muted small section-hint">{hint}</p>
      {courses.length === 0 ? (
        <p className="placeholder">{empty}</p>
      ) : (
        <div className="course-list">
          {courses.slice(0, shown).map((c) => (
            <CourseCard key={c.id} course={c} distanceFrom={distanceFrom} />
          ))}
          {courses.length > shown && (
            <button type="button" className="btn btn-block" onClick={onMore}>
              더 보기 ({courses.length - shown}개 남음)
            </button>
          )}
        </div>
      )}
    </section>
  )
}
