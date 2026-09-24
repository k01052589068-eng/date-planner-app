import { useState } from 'react'
import { useCouple } from '../CoupleProvider.jsx'
import { createInvite } from '../couple.js'
import { inviteLink } from '../pendingInvite.js'

const expiryFormat = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** 상대를 초대하는 코드 카드. 유효한 코드가 없으면 새로 만든다. */
export default function InviteCard() {
  const { user, couple } = useCouple()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const invite = couple.invite?.expiresAt?.toMillis() > Date.now() ? couple.invite : null

  async function handleCreate() {
    setBusy(true)
    setError(null)
    try {
      await createInvite(user, couple.id)
    } catch (e) {
      console.error(e)
      setError(e.message || '초대 코드를 만들지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  async function handleShare() {
    const url = inviteLink(invite.code)
    const text = `이번주 데이트에서 같이 데이트 코스 골라요! 초대 코드: ${invite.code}`
    if (navigator.share) {
      try {
        await navigator.share({ title: '이번주 데이트 초대', text, url })
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('복사하지 못했어요. 코드를 직접 알려 주세요.')
    }
  }

  return (
    <div className="card invite-card">
      {invite ? (
        <>
          <p className="card-label">초대 코드</p>
          <p className="invite-code">{invite.code}</p>
          <p className="muted small">{expiryFormat.format(invite.expiresAt.toDate())}까지 · 1회용</p>
          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={handleShare}>
              {copied ? '복사했어요!' : '초대 링크 보내기'}
            </button>
            <button type="button" className="btn" onClick={handleCreate} disabled={busy}>
              새 코드
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="card-label">상대 초대하기</p>
          <p className="muted small">초대 코드를 만들어 상대에게 보내면, 상대가 입력해 이 공간에 합류해요. 코드는 24시간 동안 한 번만 쓸 수 있어요.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={handleCreate} disabled={busy}>
            {busy ? '만드는 중…' : '초대 코드 만들기'}
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
