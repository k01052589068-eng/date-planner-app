import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCouple } from '../CoupleProvider.jsx'
import DiaryMap from '../components/DiaryMap.jsx'
import Stars from '../components/Stars.jsx'
import { entryTitle, useDiaryEntries } from '../diary.js'
import { dateWithWeekday, monthLabel } from '../format.js'

export default function Diary() {
  const { couple } = useCouple()
  const { entries, error } = useDiaryEntries(couple.id)
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'map' ? 'map' : 'list'

  return (
    <section className="page">
      <div className="row page-head">
        <h1 className="grow">다이어리</h1>
        <Link to="/diary/new" className="btn btn-primary btn-small">
          + 기록
        </Link>
      </div>

      <div className="segmented" role="tablist" aria-label="보기 방식">
        {[
          ['list', '시간순'],
          ['map', '지도'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            className={view === value ? 'selected' : ''}
            onClick={() => setParams(value === 'map' ? { view: 'map' } : {}, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="error">기록을 불러오지 못했어요.</p>}
      {entries === undefined ? (
        <p className="placeholder">불러오는 중…</p>
      ) : view === 'map' ? (
        <DiaryMap entries={entries} />
      ) : (
        <Timeline entries={entries} />
      )}
    </section>
  )
}

function Timeline({ entries }) {
  const [order, setOrder] = useState('desc')

  // 월별로 묶기
  const months = useMemo(() => {
    const sorted = order === 'desc' ? entries : [...entries].reverse()
    const byMonth = new Map()
    for (const e of sorted) {
      const ym = e.date.slice(0, 7)
      if (!byMonth.has(ym)) byMonth.set(ym, [])
      byMonth.get(ym).push(e)
    }
    return [...byMonth.entries()]
  }, [entries, order])

  if (!entries.length) {
    return (
      <div className="placeholder">
        <p>아직 기록이 없어요.</p>
        <p className="small">이번 주 추천 카드의 "다녀왔어요"나 위의 "+ 기록"으로 첫 데이트를 남겨 보세요.</p>
      </div>
    )
  }

  return (
    <>
      <div className="row timeline-head">
        <p className="grow muted small">지금까지 {entries.length}번의 데이트</p>
        <button type="button" className="btn-link" onClick={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}>
          {order === 'desc' ? '최신순' : '오래된순'} ⇅
        </button>
      </div>
      {months.map(([ym, list]) => (
        <section key={ym} className="timeline-month">
          <h2 className="section-title">{monthLabel(ym)}</h2>
          <ul className="timeline">
            {list.map((e) => (
              <li key={e.id}>
                <Link to={`/diary/${e.id}`} className="timeline-item">
                  <span className="muted small">{dateWithWeekday(e.date)}</span>
                  <span className="row timeline-title">
                    <span className="grow strong">{entryTitle(e)}</span>
                    <Stars value={e.rating} />
                  </span>
                  {e.places?.length > 0 && <span className="muted small">{e.places.map((p) => p.name).join(' · ')}</span>}
                  {e.memo && <span className="timeline-memo">{e.memo}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
