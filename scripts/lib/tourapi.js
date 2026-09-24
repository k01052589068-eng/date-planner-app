// 한국관광공사 국문 관광정보 서비스(TourAPI 4.0, KorService2) 호출
const BASE = 'https://apis.data.go.kr/B551011/KorService2'
const PAGE_SIZE = 1000

export class TourApi {
  constructor(serviceKey) {
    if (!serviceKey) throw new Error('TOURAPI_KEY 환경 변수가 없어요. scripts/.env 를 확인해 주세요.')
    this.serviceKey = serviceKey
    this.calls = 0
  }

  /** 한 페이지 호출. 응답 body 를 돌려준다. */
  async call(operation, params) {
    const url = new URL(`${BASE}/${operation}`)
    url.search = new URLSearchParams({
      serviceKey: this.serviceKey,
      MobileOS: 'ETC',
      MobileApp: 'DatePlanner',
      _type: 'json',
      ...params,
    })

    let lastError
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        this.calls++
        const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
        const text = await res.text()
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
        let json
        try {
          json = JSON.parse(text)
        } catch {
          // 키 오류·호출 한도 초과 등은 XML 로 온다 — 재시도해도 소용없다
          throw Object.assign(new Error(`TourAPI 오류 응답: ${text.slice(0, 300)}`), { fatal: true })
        }
        const header = json.response?.header
        if (header?.resultCode !== '0000') {
          throw Object.assign(new Error(`TourAPI ${header?.resultCode}: ${header?.resultMsg}`), { fatal: true })
        }
        return json.response.body
      } catch (e) {
        lastError = e
        if (e.fatal) break
        await new Promise((r) => setTimeout(r, 1000 * attempt))
      }
    }
    throw new Error(`${operation} 호출 실패: ${lastError.message}`)
  }

  /** 모든 페이지를 받아 item 배열로 돌려준다. */
  async fetchAll(operation, params = {}) {
    const items = []
    for (let pageNo = 1; ; pageNo++) {
      const body = await this.call(operation, { ...params, numOfRows: PAGE_SIZE, pageNo })
      // 결과가 없으면 items 가 빈 문자열로 온다
      const raw = body.items?.item ?? []
      const page = Array.isArray(raw) ? raw : [raw]
      items.push(...page)
      if (page.length === 0 || pageNo * PAGE_SIZE >= body.totalCount) break
    }
    return items
  }
}
