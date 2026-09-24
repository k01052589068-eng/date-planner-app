import { Link } from 'react-router-dom'
import { useCouple } from '../CoupleProvider.jsx'
import InviteCard from '../components/InviteCard.jsx'

export default function ThisWeek() {
  const { couple, partner } = useCouple()

  return (
    <section className="page">
      <h1>이번 주 데이트</h1>
      {!couple.settings?.base && (
        <div className="card notice">
          <p className="card-label">기준 위치를 정해 주세요</p>
          <p className="muted small">주로 만나는 동네를 알려 주면 가까운 코스부터 추천해요.</p>
          <Link to="/settings" className="btn btn-primary btn-block">
            설정하러 가기
          </Link>
        </div>
      )}
      {!partner && (
        <>
          <p className="muted">상대를 초대하면 추천과 다이어리를 함께 볼 수 있어요.</p>
          <InviteCard />
        </>
      )}
      <p className="placeholder">이번 주 추천 코스가 여기에 표시됩니다. (5단계에서 구현)</p>
    </section>
  )
}
