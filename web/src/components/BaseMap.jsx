import { useEffect, useRef, useState } from 'react'
import { KAKAO_LOAD_ERROR, loadKakao } from '../kakao.js'

/** 기준 위치와 이동 반경을 보여주는 작은 지도 (조작 불가). radiusKm 이 null 이면 전국. */
export default function BaseMap({ lat, lng, radiusKm }) {
  const containerRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const el = containerRef.current
    let cancelled = false
    loadKakao()
      .then((kakao) => {
        if (cancelled) return
        const center = new kakao.maps.LatLng(lat, lng)
        const map = new kakao.maps.Map(el, {
          center,
          level: 13,
          draggable: false,
          scrollwheel: false,
          disableDoubleClickZoom: true,
          keyboardShortcuts: false,
        })
        new kakao.maps.Marker({ map, position: center })
        if (radiusKm) {
          const circle = new kakao.maps.Circle({
            map,
            center,
            radius: radiusKm * 1000,
            strokeWeight: 2,
            strokeColor: '#ff5a6e',
            strokeOpacity: 0.8,
            fillColor: '#ff5a6e',
            fillOpacity: 0.08,
          })
          map.setBounds(circle.getBounds())
        }
      })
      .catch(() => !cancelled && setError(KAKAO_LOAD_ERROR))
    return () => {
      cancelled = true
      el.innerHTML = '' // 카카오 지도에는 해제 API가 없어 컨테이너를 비운다
    }
  }, [lat, lng, radiusKm])

  return (
    <div className="base-map">
      {/* 카카오가 직접 그리는 영역은 React 요소와 분리한다 */}
      <div className="base-map-canvas" ref={containerRef} />
      {error && <p className="muted small base-map-error">{error}</p>}
    </div>
  )
}
