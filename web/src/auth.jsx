import { createContext, useContext, useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { auth } from './firebase.js'

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = 확인 중, null = 로그아웃
  const [error, setError] = useState(null)

  useEffect(() => {
    // 리디렉션 로그인에서 돌아왔을 때 실패 사유를 받아온다
    getRedirectResult(auth).catch((e) => setError(loginErrorMessage(e)))
    return onAuthStateChanged(auth, setUser)
  }, [])

  return <AuthContext.Provider value={{ user, error, setError }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

// 홈 화면에 설치한 PWA(standalone)에서는 팝업이 별도 창으로 떠서 결과를 못 받는 경우가 있어 리디렉션을 쓴다.
// 일반 브라우저는 팝업을 먼저 시도하고, 팝업이 막히면 리디렉션으로 전환한다.
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export async function signInWithGoogle() {
  if (isStandalone()) return signInWithRedirect(auth, provider)
  try {
    await signInWithPopup(auth, provider)
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      return signInWithRedirect(auth, provider)
    }
    throw e
  }
}

export function logOut() {
  return signOut(auth)
}

/** 사용자에게 보여줄 메시지. 사용자가 스스로 닫은 경우는 null. */
export function loginErrorMessage(e) {
  switch (e.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인하고 다시 시도해 주세요.'
    case 'auth/unauthorized-domain':
      return '로그인이 허용되지 않은 주소예요. (Firebase 승인된 도메인 설정 필요)'
    case 'auth/web-storage-unsupported':
      return '이 브라우저 설정에서는 로그인할 수 없어요. 쿠키·사이트 데이터 차단을 해제하거나 다른 브라우저로 열어 주세요.'
    default:
      return `로그인에 실패했어요. 잠시 후 다시 시도해 주세요. (${e.code || e.message})`
  }
}
