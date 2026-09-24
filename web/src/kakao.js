// 카카오맵 JavaScript SDK 로더. 키는 카카오 디벨로퍼스에 등록한 도메인에서만 동작하므로 공개돼도 된다.
export const KAKAO_JS_KEY = '9acc3b65db5bcedf2151c70bc71d674d'

let loading = null

/** SDK(services·clusterer 포함)를 한 번만 불러와 window.kakao 를 돌려준다. */
export function loadKakao() {
  if (window.kakao?.maps?.services) return Promise.resolve(window.kakao)
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&libraries=services,clusterer&autoload=false`
    script.async = true
    script.onload = () => {
      // 등록되지 않은 도메인이면 스크립트는 받아지지만 kakao 객체가 없다
      if (!window.kakao?.maps) return reject(new Error('kakao-sdk-unavailable'))
      window.kakao.maps.load(() => resolve(window.kakao))
    }
    script.onerror = () => reject(new Error('kakao-sdk-load-failed'))
    document.head.appendChild(script)
  }).catch((e) => {
    loading = null // 네트워크가 돌아오면 다시 시도할 수 있게
    throw e
  })
  return loading
}

export const KAKAO_LOAD_ERROR = '카카오 지도를 불러오지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.'
