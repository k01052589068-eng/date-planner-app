import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useCouple } from '../CoupleProvider.jsx'
import CourseCard from '../components/CourseCard.jsx'
import InviteCard from '../components/InviteCard.jsx'
import { weekRange } from '../format.js'
import { currentWeek, generateRecs, hasPool, recsCollection, settingsChanged } from '../weeklyRecs.js'

const RECENT_WEEKS = 6

export default function ThisWeek() {
  const { couple, partner } = useCouple()
  const week = useMemo(currentWeek, [])
  const hasBase = !!couple.settings?.base

  const [recent, setRecent] = useState(null) // { docs: [...최신순], fromCache }
  const [selectedId, setSelectedId] = useState(week.weekId)
  const [status, setStatus] = useState('idle') // idle | generating | empty | error
  const generating = useRef(false)
  const checkedNewPool = useRef(false)

  // 최근 추천 목록을 실시간으로 (상대가 다시 추천받아도 바로 반영)
  useEffect(
    () =>
      onSnapshot(
        query(recsCollection(couple.id), orderBy('weekId', 'desc'), limit(RECENT_WEEKS)),
        // 캐시에서 먼저 온 결과만 보고 "없다"고 판단하지 않도록 서버 확인 여부까지 받는다
        { includeMetadataChanges: true },
        (snap) => setRecent({ docs: snap.docs.map((d) => d.data()), fromCache: snap.metadata.fromCache }),
        (e) => {
          console.error(e)
          setStatus('error')
        },
      ),
    [couple.id],
  )

  const current = recent?.docs.find((d) => d.weekId === week.weekId)

  const regenerate = useCallback(async () => {
    if (generating.current) return
    generating.current = true
    setStatus('generating')
    try {
      const data = await generateRecs(couple, week)
      setStatus(data ? 'idle' : 'empty')
    } catch (e) {
      console.error(e)
      setStatus('error')
    } finally {
      generating.current = false
    }
  }, [couple, week])

  // 이번 주 추천이 아직 없으면 만든다
  useEffect(() => {
    if (hasBase && recent && !recent.fromCache && !current && status === 'idle') regenerate()
  }, [hasBase, recent, current, status, regenerate])

  // 지난주 풀로 임시 추천했다면, 이번 주 풀이 올라왔는지 한 번 확인해 다시 만든다
  useEffect(() => {
    if (!current || current.poolWeekId === week.weekId || checkedNewPool.current) return
    checkedNewPool.current = true
    hasPool(couple, week.weekId).then((ready) => ready && regenerate())
  }, [current, couple, week, regenerate])

  const selected = recent?.docs.find((d) => d.weekId === selectedId)
  const isCurrent = selectedId === week.weekId
  const pastWeeks = recent?.docs.filter((d) => d.weekId !== week.weekId) ?? []

  return (
    <section className="page">
      <h1>이번 주 데이트</h1>
      <p className="muted small page-sub">{weekRange(week)}</p>

      {!hasBase && (
        <div className="card notice">
          <p className="card-label">기준 위치를 정해 주세요</p>
          <p className="muted small">주로 만나는 동네를 알려 주면 가까운 코스부터 추천해요.</p>
          <Link to="/settings" className="btn btn-primary btn-block">
            설정하러 가기
          </Link>
        </div>
      )}

      {!partner && (
        <details className="card invite-details">
          <summary className="card-label">상대를 초대하면 추천과 다이어리를 함께 봐요</summary>
          <InviteCard />
        </details>
      )}

      {pastWeeks.length > 0 && (
        <div className="chips week-chips" role="tablist" aria-label="주차 선택">
          <WeekChip selected={isCurrent} onClick={() => setSelectedId(week.weekId)}>
            이번 주
          </WeekChip>
          {pastWeeks.map((d) => (
            <WeekChip key={d.weekId} selected={selectedId === d.weekId} onClick={() => setSelectedId(d.weekId)}>
              {weekRange(d.period)}
            </WeekChip>
          ))}
        </div>
      )}

      {isCurrent && current && settingsChanged(current, couple.settings) && (
        <div className="card notice">
          <p className="small">설정이 바뀌었어요. 새 설정으로 이번 주 추천을 다시 받을까요?</p>
          <button type="button" className="btn btn-primary btn-block" onClick={regenerate} disabled={status === 'generating'}>
            {status === 'generating' ? '추천 만드는 중…' : '다시 추천받기'}
          </button>
        </div>
      )}

      {isCurrent && current && current.poolWeekId !== week.weekId && (
        <p className="muted small">이번 주 코스가 아직 준비 중이라 지난주 코스에서 골랐어요.</p>
      )}

      {hasBase && <RecsBody selected={selected} isCurrent={isCurrent} status={status} loading={!recent} onRetry={regenerate} />}

      {/* 주중에 트렌드 코스(C)가 추가되면 이걸로 다시 받는다. 같은 데이터면 같은 결과가 나온다. */}
      {isCurrent && current && (
        <button type="button" className="btn-link refresh-link" onClick={regenerate} disabled={status === 'generating'}>
          {status === 'generating' ? '추천 만드는 중…' : '최신 코스로 다시 추천받기'}
        </button>
      )}
    </section>
  )
}

function RecsBody({ selected, isCurrent, status, loading, onRetry }) {
  if (selected) {
    if (!selected.courses.length) return <p className="placeholder">조건에 맞는 코스를 찾지 못했어요. 이동 반경을 넓혀 보세요.</p>
    return (
      <div className="course-list">
        {selected.courses.map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </div>
    )
  }
  if (!isCurrent) return null
  if (status === 'empty') {
    return <p className="placeholder">이번 주 추천 코스를 준비하고 있어요. 코스는 매주 월요일 0시에 새로 만들어져요.</p>
  }
  if (status === 'error') {
    return (
      <div className="placeholder">
        <p>추천을 불러오지 못했어요.</p>
        <button type="button" className="btn btn-small" onClick={onRetry}>
          다시 시도
        </button>
      </div>
    )
  }
  return <p className="placeholder">{loading ? '불러오는 중…' : '이번 주 추천을 고르고 있어요…'}</p>
}

function WeekChip({ selected, onClick, children }) {
  return (
    <button type="button" role="tab" aria-selected={selected} className={`chip${selected ? ' selected' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}
