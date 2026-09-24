import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { useCouple } from '../CoupleProvider.jsx'
import PlacePicker from '../components/PlacePicker.jsx'
import Stars from '../components/Stars.jsx'
import { diaryCollection, newEntry, saveEntry } from '../diary.js'

/** 다이어리 작성(/diary/new, "다녀왔어요"면 코스로 미리 채움)과 수정(/diary/:id/edit) */
export default function DiaryEdit() {
  const { id } = useParams()
  const { couple } = useCouple()
  const course = useLocation().state?.course
  const [entry, setEntry] = useState(() => (id ? undefined : newEntry(course)))
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    if (!id) return
    getDoc(doc(diaryCollection(couple.id), id))
      .then((snap) => (snap.exists() ? setEntry(snap.data()) : setLoadError('기록을 찾을 수 없어요.')))
      .catch((e) => {
        console.error(e)
        setLoadError('기록을 불러오지 못했어요.')
      })
  }, [id, couple.id])

  if (loadError) return <p className="placeholder">{loadError}</p>
  if (!entry) return <p className="placeholder">불러오는 중…</p>
  return <DiaryForm id={id} initial={entry} fromCourse={!id && !!course} />
}

function DiaryForm({ id, initial, fromCourse }) {
  const { user, couple } = useCouple()
  const navigate = useNavigate()
  const [entry, setEntry] = useState(initial)
  const [costText, setCostText] = useState(initial.cost != null ? String(initial.cost) : '')
  const [picking, setPicking] = useState(false)
  const set = (patch) => setEntry((e) => ({ ...e, ...patch }))

  const addPlace = useCallback((p) => {
    const place = { name: p.name, address: p.address ?? '', lat: p.lat, lng: p.lng, ...(p.kakaoId ? { kakaoId: p.kakaoId } : {}) }
    setEntry((e) => ({ ...e, places: [...e.places, place] }))
    setPicking(false)
  }, [])
  const closePicker = useCallback(() => setPicking(false), [])

  function handleSubmit(e) {
    e.preventDefault()
    const digits = costText.replace(/[^0-9]/g, '')
    const savedId = saveEntry(couple.id, id, { ...entry, cost: digits ? Number(digits) : null }, user, (err) => {
      console.error(err)
      alert('기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    })
    navigate(`/diary/${savedId}`, { replace: true })
  }

  return (
    <section className="page">
      <h1>{id ? '기록 수정' : '다이어리 쓰기'}</h1>
      {fromCourse && <p className="muted small page-sub">추천 코스 내용으로 채워 두었어요. 실제로 간 대로 고쳐 주세요.</p>}

      <form className="diary-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="card-label">날짜</span>
          <input type="date" className="input" value={entry.date} onChange={(e) => set({ date: e.target.value })} required />
        </label>

        <label className="field">
          <span className="card-label">제목</span>
          <input
            className="input"
            value={entry.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="예: 송도 센트럴파크 산책"
            maxLength={80}
          />
        </label>

        <div className="field">
          <span className="card-label">다녀온 곳</span>
          {entry.places.length > 0 && (
            <ul className="place-chips">
              {entry.places.map((p, i) => (
                <li key={`${p.name}-${i}`}>
                  <span className="grow">
                    <span className="strong">{p.name}</span>
                    {p.address && <span className="muted small"> · {p.address}</span>}
                  </span>
                  <button
                    type="button"
                    className="icon-btn icon-btn-small"
                    aria-label={`${p.name} 빼기`}
                    onClick={() => set({ places: entry.places.filter((_, j) => j !== i) })}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn btn-small" onClick={() => setPicking(true)}>
            + 장소 추가
          </button>
        </div>

        <div className="field">
          <span className="card-label">별점</span>
          <Stars value={entry.rating} onChange={(rating) => set({ rating })} />
        </div>

        <label className="field">
          <span className="card-label">한 줄 메모</span>
          <textarea
            className="input textarea"
            rows={2}
            value={entry.memo}
            onChange={(e) => set({ memo: e.target.value })}
            placeholder="기억하고 싶은 한마디"
            maxLength={300}
          />
        </label>

        <label className="field">
          <span className="card-label">비용 (선택)</span>
          <div className="input-suffix">
            <input
              className="input"
              inputMode="numeric"
              value={costText ? Number(costText.replace(/[^0-9]/g, '') || 0).toLocaleString('ko-KR') : ''}
              onChange={(e) => setCostText(e.target.value.replace(/[^0-9]/g, '').slice(0, 9))}
              placeholder="0"
            />
            <span className="muted">원</span>
          </div>
        </label>

        <div className="button-row">
          <button type="button" className="btn" onClick={() => navigate(-1)}>
            취소
          </button>
          <button type="submit" className="btn btn-primary" disabled={!entry.date}>
            저장
          </button>
        </div>
      </form>

      {picking && <PlacePicker title="다녀온 곳 검색" onSelect={addPlace} onClose={closePicker} />}
    </section>
  )
}
