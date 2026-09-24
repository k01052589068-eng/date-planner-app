import { KAKAO_LOAD_ERROR, loadKakao } from './kakao.js'
import { normalizeSido } from './shared/regions.js'

/** 기기 위치를 받아 카카오 주소 변환으로 { name, address, lat, lng, sido } 를 만든다. 실패하면 안내 문구를 담은 Error. */
export async function getCurrentPlace() {
  if (!navigator.geolocation) throw new Error('이 브라우저에서는 현재 위치를 쓸 수 없어요.')

  const coords = await new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? '위치 권한이 꺼져 있어요. 브라우저 설정에서 허용하거나 검색으로 지정해 주세요.'
              : '현재 위치를 가져오지 못했어요. 검색으로 지정해 주세요.',
          ),
        ),
      { timeout: 10000, maximumAge: 10 * 60 * 1000 },
    ),
  )

  let kakao
  try {
    kakao = await loadKakao()
  } catch {
    throw new Error(KAKAO_LOAD_ERROR)
  }

  const regions = await new Promise((resolve) =>
    new kakao.maps.services.Geocoder().coord2RegionCode(coords.longitude, coords.latitude, (res, status) =>
      resolve(status === kakao.maps.services.Status.OK ? res : []),
    ),
  )
  const r = regions.find((x) => x.region_type === 'H') || regions[0] // H: 행정동
  if (!r) throw new Error('현재 위치의 주소를 찾지 못했어요. 검색으로 지정해 주세요.')

  return {
    name: [r.region_2depth_name, r.region_3depth_name].filter(Boolean).join(' ') || r.address_name,
    address: r.address_name,
    lat: coords.latitude,
    lng: coords.longitude,
    sido: normalizeSido(r.region_1depth_name),
  }
}
