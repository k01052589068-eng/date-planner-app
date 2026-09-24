import { Link, useLocation } from 'react-router-dom'

/** "다녀왔어요"로 들어오는 다이어리 작성 화면 — 7단계에서 구현 */
export default function DiaryNew() {
  const course = useLocation().state?.course

  return (
    <section className="page">
      <h1>다이어리 쓰기</h1>
      {course && <p className="strong">{course.title}</p>}
      <p className="placeholder">다녀온 데이트를 기록하는 화면은 7단계에서 만들어져요. 코스 정보가 미리 채워질 예정이에요.</p>
      <Link to="/" className="btn btn-block">
        이번 주 추천으로 돌아가기
      </Link>
    </section>
  )
}
