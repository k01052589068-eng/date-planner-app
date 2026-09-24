// 카카오 로컬 API(REST) 키워드 장소 검색 — 트렌드 파일의 좌표를 채울 때 쓴다.
// REST API 키는 JavaScript 키와 달리 도메인 제한이 없으니 저장소에 올리지 않는다 (scripts/.env 의 KAKAO_REST_KEY).
export async function searchPlace(query, restKey) {
  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json')
  url.search = new URLSearchParams({ query, size: '5' })
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${restKey}` }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`카카오 장소 검색 실패 (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`)
  const { documents } = await res.json()
  return documents.map((d) => ({
    name: d.place_name,
    addr: d.road_address_name || d.address_name,
    lat: Number(d.y),
    lng: Number(d.x),
    category: d.category_name,
    url: d.place_url,
  }))
}
