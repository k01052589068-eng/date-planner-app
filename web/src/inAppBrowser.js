// 구글은 앱 내장 브라우저(웹뷰)에서의 로그인을 막는다(403 disallowed_useragent).
// 카톡 등으로 링크를 받아 연 경우를 감지해 외부 브라우저로 안내한다.
const ua = navigator.userAgent

export const inAppBrowser = /KAKAOTALK/i.test(ua)
  ? 'kakaotalk'
  : /Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|everytimeApp|; wv\)/i.test(ua)
    ? 'other'
    : null

const isAndroid = /Android/i.test(ua)

/** 외부 브라우저로 현재 주소를 연다. 자동으로 열 수 없는 환경이면 false. */
export function openInExternalBrowser() {
  const url = location.href
  if (inAppBrowser === 'kakaotalk') {
    location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
    return true
  }
  if (isAndroid) {
    location.href = `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`
    return true
  }
  return false
}
