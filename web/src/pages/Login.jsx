import { useState } from 'react'
import { loginErrorMessage, signInWithGoogle, useAuth } from '../auth.jsx'
import { inAppBrowser, openInExternalBrowser } from '../inAppBrowser.js'

export default function Login() {
  const { error, setError } = useAuth()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleLogin() {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      console.error(e)
      setError(loginErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
    } catch {
      // 복사가 막힌 환경이면 안내 문구만 본다
    }
  }

  return (
    <div className="centered-screen">
      <div className="brand">
        <span className="brand-icon" aria-hidden="true">💝</span>
        <h1>이번주 데이트</h1>
        <p className="muted">매주 월요일, 둘이 함께 갈 데이트 코스를 추천해 드려요.</p>
      </div>

      {inAppBrowser ? (
        <div className="card notice">
          <p>
            <strong>{inAppBrowser === 'kakaotalk' ? '카카오톡' : '앱'} 안의 브라우저에서는 구글 로그인이 막혀 있어요.</strong>
          </p>
          <p className="muted small">크롬이나 사파리 같은 기본 브라우저에서 열어 주세요.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => openInExternalBrowser() || handleCopyLink()}>
            기본 브라우저로 열기
          </button>
          {copied && (
            <p className="muted small">
              주소를 복사했어요. 화면의 <strong>···</strong> 메뉴에서 &lsquo;Safari로 열기&rsquo;를 누르거나, 사파리에 붙여넣어 주세요.
            </p>
          )}
        </div>
      ) : (
        <button type="button" className="btn btn-google btn-block" onClick={handleLogin} disabled={busy}>
          <GoogleLogo />
          {busy ? '로그인 중…' : 'Google 계정으로 시작하기'}
        </button>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
