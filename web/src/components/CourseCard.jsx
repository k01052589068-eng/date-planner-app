import { useNavigate } from 'react-router-dom'
import { hopLabel, kakaoMapLink, periodLabel } from '../format.js'
import { kstDate } from '../shared/week.js'
import CourseMap from './CourseMap.jsx'

const STOP_TYPE = { event: '행사', place: '볼거리', meal: '식사', cafe: '카페' }

/** distanceFrom: 거리 문구의 기준 ('기준 위치', 검색한 장소 이름 등) */
export default function CourseCard({ course, distanceFrom = '기준 위치' }) {
  const navigate = useNavigate()
  const main = course.stops[0]
  const place = [course.sido, course.sigungu].filter(Boolean).join(' ')

  return (
    <article className="course-card">
      {course.image && (
        <div className="course-image">
          <img src={course.image} alt="" loading="lazy" />
          <span className="image-credit">사진 한국관광공사</span>
        </div>
      )}

      <div className="course-body">
        <div className="badges">
          {course.kind === 'irregular' && <span className="badge badge-event">이번 주만</span>}
          {course.novel && <span className="badge badge-novel">새로운 시도</span>}
          {course.source === 'C' && <span className="badge badge-trend">트렌드</span>}
          {course.seasonNote && <span className="badge">{course.seasonNote}</span>}
        </div>

        <h2 className="course-title">{course.title}</h2>
        <p className="muted small">
          {place}
          {course.distKm != null && ` · ${distanceFrom}에서 ${course.distKm}km`}
          {course.period && ` · ${periodLabel(course.period, kstDate())}`}
        </p>
        {course.summary && <p className="course-summary">{course.summary}</p>}

        <CourseMap stops={course.stops} />

        <ol className="stop-list">
          {course.stops.map((s) => (
            <li key={s.contentId || s.order}>
              <span className="stop-no">{s.order}</span>
              <a href={kakaoMapLink(s)} target="_blank" rel="noopener noreferrer" className="stop-name">
                {s.name}
              </a>
              <span className="muted small">
                {s.label || STOP_TYPE[s.type] || ''}
                {/* distKm 은 메인(1번)에서의 거리 */}
                {s.order > 1 && s.distKm != null && ` · 1번에서 ${hopLabel(s.distKm)}`}
              </span>
            </li>
          ))}
        </ol>

        <div className="button-row">
          <a className="btn" href={kakaoMapLink(main)} target="_blank" rel="noopener noreferrer">
            카카오맵에서 보기
          </a>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/diary/new', { state: { course } })}>
            다녀왔어요
          </button>
        </div>
      </div>
    </article>
  )
}
