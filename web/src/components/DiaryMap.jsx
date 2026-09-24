import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Stars from './Stars.jsx'
import { entryTitle, placeKey } from '../diary.js'
import { dateWithWeekday } from '../format.js'
import { KAKAO_LOAD_ERROR, loadKakao } from '../kakao.js'

/** 장소별 보기: 다녀온 곳마다 핀(가까우면 묶음), 핀을 누르면 그 장소의 기록 목록 */
export default function DiaryMap({ entries }) {
  const containerRef = useRef(null)
  const [selectedKey, setSelectedKey] = useState(null)
  const [error, setError] = useState(null)

  // 장소별로 기록 묶기 (최신 기록 먼저)
  const groups = useMemo(() => {
    const byKey = new Map()
    for (const e of entries) {
      for (const p of e.places ?? []) {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
        const key = placeKey(p)
        if (!byKey.has(key)) byKey.set(key, { key, place: p, entries: [] })
        const g = byKey.get(key)
        if (!g.entries.includes(e)) g.entries.push(e)
      }
    }
    return [...byKey.values()]
  }, [entries])
  const groupsSignature = groups.map((g) => `${g.key}:${g.entries.length}`).join('|')

  useEffect(() => {
    const el = containerRef.current
    let cancelled = false
    loadKakao()
      .then((kakao) => {
        if (cancelled) return
        const { LatLng, LatLngBounds } = kakao.maps
        const map = new kakao.maps.Map(el, { center: new LatLng(36.4, 127.8), level: 13 })
        if (!groups.length) return
        const markers = groups.map((g) => {
          const marker = new kakao.maps.Marker({ position: new LatLng(g.place.lat, g.place.lng), title: g.place.name })
          kakao.maps.event.addListener(marker, 'click', () => setSelectedKey(g.key))
          return marker
        })
        const clusterer = new kakao.maps.MarkerClusterer({ map, averageCenter: true, minLevel: 7 })
        clusterer.addMarkers(markers)
        // 처음엔 모든 핀이 보이도록
        if (markers.length === 1) {
          map.setCenter(markers[0].getPosition())
          map.setLevel(5)
        } else {
          const bounds = new LatLngBounds()
          markers.forEach((m) => bounds.extend(m.getPosition()))
          map.setBounds(bounds, 40, 40, 40, 40)
        }
      })
      .catch(() => !cancelled && setError(KAKAO_LOAD_ERROR))
    return () => {
      cancelled = true
      el.innerHTML = ''
    }
    // groups 는 서명으로 비교 (기록이 실제로 바뀔 때만 다시 그림)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsSignature])

  const selected = groups.find((g) => g.key === selectedKey)

  return (
    <div className="diary-map">
      <div className="base-map-canvas" ref={containerRef} />
      {error && <p className="muted small base-map-error">{error}</p>}
      {!error && groups.length === 0 && <p className="map-empty muted small">장소를 넣은 기록이 생기면 지도에 표시돼요.</p>}

      {selected && (
        <div className="map-sheet" role="dialog" aria-label={`${selected.place.name} 기록`}>
          <div className="row">
            <p className="grow strong">{selected.place.name}</p>
            <button type="button" className="icon-btn icon-btn-small" onClick={() => setSelectedKey(null)} aria-label="닫기">
              ×
            </button>
          </div>
          <p className="muted small">{selected.entries.length}번 다녀왔어요</p>
          <ul className="sheet-list">
            {selected.entries.map((e) => (
              <li key={e.id}>
                <Link to={`/diary/${e.id}`} className="sheet-item">
                  <span className="muted small">{dateWithWeekday(e.date)}</span>
                  <span className="strong">{entryTitle(e)}</span>
                  <Stars value={e.rating} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
