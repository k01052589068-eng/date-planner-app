// 초대 링크(/join?code=XXXXXX)로 들어온 코드를 로그인(리디렉션 포함)을 거치는 동안 보관한다.
const KEY = 'pendingInviteCode'

export function captureInviteFromUrl() {
  if (location.pathname !== '/join') return
  const code = new URLSearchParams(location.search).get('code')
  if (!code) return
  try {
    sessionStorage.setItem(KEY, code)
  } catch {
    // 저장소를 못 쓰는 환경이면 직접 입력하면 된다
  }
}

export function getPendingInvite() {
  try {
    return sessionStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

export function clearPendingInvite() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // 무시
  }
}

export function inviteLink(code) {
  return `${location.origin}/join?code=${code}`
}
