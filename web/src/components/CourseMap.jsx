import { useEffect, useRef, useState } from 'react'
import { KAKAO_LOAD_ERROR, loadKakao } from '../kakao.js'

/** 코스 경로 미니맵: 정류장 번호 핀 + 순서대로 잇는 선. 화면에 보일 때 그린다. */
export default function CourseMap({ stops }) {
  const containerRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const el = containerRef.current
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const key = stops.map((s) => `${s.lat},${s.lng}`).join('|')
  useEffect(() => {
    if (!visible) return
    const el = containerRef.current
    let cancelled = false
    loadKakao()
      .then((kakao) => {
        if (cancelled) return
        const points = stops.map((s) => new kakao.maps.LatLng(s.lat, s.lng))
        const map = new kakao.maps.Map(el, {
          center: points[0],
          level: 4,
          draggable: false,
          scrollwheel: false,
          disableDoubleClickZoom: true,
          keyboardShortcuts: false,
        })
        if (points.length > 1) {
          new kakao.maps.Polyline({
            map,
            path: points,
            strokeWeight: 3,
            strokeColor: '#ff5a6e',
            strokeOpacity: 0.8,
            strokeStyle: 'shortdash',
          })
          const bounds = new kakao.maps.LatLngBounds()
          points.forEach((p) => bounds.extend(p))
          map.setBounds(bounds, 30, 30, 30, 30)
        }
        points.forEach((position, i) => {
          const pin = document.createElement('div')
          pin.className = 'map-pin'
          pin.textContent = String(i + 1)
          new kakao.maps.CustomOverlay({ map, position, content: pin, yAnchor: 0.5 })
        })
      })
      .catch(() => !cancelled && setError(KAKAO_LOAD_ERROR))
    return () => {
      cancelled = true
      el.innerHTML = ''
    }
    // stops 는 key 로 비교한다 (같은 코스를 다시 그리지 않도록)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, key])

  return (
    <div className="course-map">
      <div className="base-map-canvas" ref={containerRef} />
      {error && <p className="muted small base-map-error">{error}</p>}
    </div>
  )
}
