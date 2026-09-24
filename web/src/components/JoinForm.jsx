import { useState } from 'react'
import { useCouple } from '../CoupleProvider.jsx'
import { joinWithCode, normalizeCode } from '../couple.js'
import { clearPendingInvite, getPendingInvite } from '../pendingInvite.js'

/** 초대 코드 입력 폼. 혼자 쓰던 공간이 있으면(currentCoupleId) 그 기록을 가지고 합류한다. */
export default function JoinForm({ currentCoupleId = null }) {
  const { user } = useCouple()
  const [code, setCode] = useState(() => normalizeCode(getPendingInvite()).slice(0, 6))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await joinWithCode(user, code, currentCoupleId)
      clearPendingInvite()
    } catch (err) {
      console.error(err)
      setError(err.message || '합류하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  return (
    <form className="join-form" onSubmit={handleSubmit}>
      <input
        className="input code-input"
        value={code}
        onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, 6))}
        placeholder="ABC123"
        aria-label="초대 코드"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
      />
      <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6}>
        {busy ? '합류 중…' : '합류하기'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
