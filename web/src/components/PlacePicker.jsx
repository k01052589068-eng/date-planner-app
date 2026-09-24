import { useEffect, useRef, useState } from 'react'
import { KAKAO_LOAD_ERROR, loadKakao } from '../kakao.js'
import { getCurrentPlace } from '../currentLocation.js'
import { normalizeSido } from '../regions.js'

/**
 * 카카오 장소 검색으로 위치 하나를 고르는 전체 화면 창.
 * onSelect({ name, address, lat, lng, sido })
 */
export default function PlacePicker({ title = '위치 검색', onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState(null)
  const [locating, setLocating] = useState(false)
  const latestQuery = useRef('')

  useEffect(() => {
    loadKakao().catch(() => setMessage(KAKAO_LOAD_ERROR))
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 입력이 멈추고 0.3초 뒤 검색
  useEffect(() => {
    const q = query.trim()
    latestQuery.current = q
    if (q.length < 2) return
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const kakao = await loadKakao()
        new kakao.maps.services.Places().keywordSearch(
          q,
          (data, status) => {
            if (latestQuery.current !== q) return // 더 최근 검색이 있으면 버림
            setSearching(false)
            if (status === kakao.maps.services.Status.OK) {
              setResults(data)
              setMessage(null)
            } else {
              setResults([])
              setMessage(status === kakao.maps.services.Status.ZERO_RESULT ? '검색 결과가 없어요.' : '검색하지 못했어요. 잠시 후 다시 시도해 주세요.')
            }
          },
          { size: 15 },
        )
      } catch {
        setSearching(false)
        setMessage(KAKAO_LOAD_ERROR)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  function handleQueryChange(e) {
    setQuery(e.target.value)
    if (e.target.value.trim().length < 2) {
      setResults([])
      setMessage(null)
    }
  }

  function selectPlace(p) {
    onSelect({
      name: p.place_name,
      address: p.road_address_name || p.address_name,
      lat: Number(p.y),
      lng: Number(p.x),
      sido: normalizeSido(p.address_name),
    })
  }

  async function handleCurrentLocation() {
    setLocating(true)
    setMessage(null)
    try {
      onSelect(await getCurrentPlace())
    } catch (e) {
      setMessage(e.message)
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-header">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
          ←
        </button>
        <input
          className="input grow"
          value={query}
          onChange={handleQueryChange}
          placeholder="동네, 역, 장소 이름 (예: 송도)"
          aria-label="장소 검색어"
          enterKeyHint="search"
        />
      </div>

      <div className="sheet-body">
        <button type="button" className="btn btn-block" onClick={handleCurrentLocation} disabled={locating}>
          📍 {locating ? '현재 위치 확인 중…' : '현재 위치로 지정'}
        </button>

        {searching && <p className="muted small">검색 중…</p>}
        {message && <p className="muted small">{message}</p>}

        <ul className="place-list">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" className="place-item" onClick={() => selectPlace(p)}>
                <span className="strong">{p.place_name}</span>
                <span className="muted small">
                  {p.road_address_name || p.address_name}
                  {p.category_group_name && ` · ${p.category_group_name}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
