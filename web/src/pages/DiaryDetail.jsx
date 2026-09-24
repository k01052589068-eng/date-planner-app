import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { useCouple } from '../CoupleProvider.jsx'
import Stars from '../components/Stars.jsx'
import { deleteEntry, diaryCollection, entryTitle } from '../diary.js'
import { dateWithWeekday, kakaoMapLink, won } from '../format.js'

export default function DiaryDetail() {
  const { id } = useParams()
  const { couple } = useCouple()
  const navigate = useNavigate()
  const [state, setState] = useState({ id, entry: undefined })

  useEffect(
    () =>
      onSnapshot(
        doc(diaryCollection(couple.id), id),
        (snap) => setState({ id, entry: snap.exists() ? snap.data() : null }),
        (e) => {
          console.error(e)
          setState({ id, entry: null })
        },
      ),
    [couple.id, id],
  )
  const entry = state.id === id ? state.entry : undefined

  async function handleDelete() {
    if (!window.confirm('이 기록을 지울까요? 두 사람 모두에게서 지워져요.')) return
    try {
      await deleteEntry(couple.id, id)
      navigate('/diary', { replace: true })
    } catch (e) {
      console.error(e)
      alert('지우지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  if (entry === undefined) return <p className="placeholder">불러오는 중…</p>
  if (entry === null) {
    return (
      <section className="page">
        <p className="placeholder">기록을 찾을 수 없어요. 지워졌을 수 있어요.</p>
        <Link to="/diary" className="btn btn-block">
          다이어리로
        </Link>
      </section>
    )
  }

  return (
    <section className="page diary-detail">
      <Link to="/diary" className="back-link">
        ← 다이어리
      </Link>
      <p className="muted">{dateWithWeekday(entry.date)}</p>
      <h1>{entryTitle(entry)}</h1>
      <Stars value={entry.rating} size="large" />

      {entry.memo && <p className="diary-memo">{entry.memo}</p>}

      {entry.places?.length > 0 && (
        <div className="card">
          <p className="card-label">다녀온 곳</p>
          <ol className="stop-list">
            {entry.places.map((p, i) => (
              <li key={`${p.name}-${i}`}>
                <span className="stop-no">{i + 1}</span>
                <a href={kakaoMapLink(p)} target="_blank" rel="noopener noreferrer" className="stop-name">
                  {p.name}
                </a>
                {p.address && <span className="muted small">{p.address}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      <dl className="diary-meta">
        {entry.cost != null && (
          <>
            <dt>비용</dt>
            <dd>{won(entry.cost)}</dd>
          </>
        )}
        {entry.courseTitle && (
          <>
            <dt>추천 코스</dt>
            <dd>{entry.courseTitle}</dd>
          </>
        )}
        {entry.authorName && (
          <>
            <dt>작성</dt>
            <dd>{entry.authorName}</dd>
          </>
        )}
      </dl>

      <div className="button-row">
        <button type="button" className="btn btn-danger" onClick={handleDelete}>
          삭제
        </button>
        <Link to={`/diary/${id}/edit`} className="btn btn-primary">
          수정
        </Link>
      </div>
    </section>
  )
}
