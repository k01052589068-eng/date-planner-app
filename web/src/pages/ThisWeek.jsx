import { useCouple } from '../CoupleProvider.jsx'
import InviteCard from '../components/InviteCard.jsx'

export default function ThisWeek() {
  const { partner } = useCouple()

  return (
    <section className="page">
      <h1>이번 주 데이트</h1>
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
