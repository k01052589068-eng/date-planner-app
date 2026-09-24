/** 두 좌표 사이 거리(km) */
export function distanceKm(a, b) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// 격자(약 5km) 공간 색인 — 주변 장소를 빠르게 찾는다
const CELL = 0.05

export class GridIndex {
  constructor(points) {
    this.cells = new Map()
    for (const p of points) {
      const key = this.#key(p.lat, p.lng)
      if (!this.cells.has(key)) this.cells.set(key, [])
      this.cells.get(key).push(p)
    }
  }

  #key(lat, lng) {
    return `${Math.floor(lat / CELL)}:${Math.floor(lng / CELL)}`
  }

  /** center 에서 radiusKm 안의 점들을 가까운 순으로 { point, distKm } (radiusKm 은 5km 이하) */
  near(center, radiusKm) {
    const ci = Math.floor(center.lat / CELL)
    const cj = Math.floor(center.lng / CELL)
    const found = []
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (const p of this.cells.get(`${ci + di}:${cj + dj}`) ?? []) {
          const distKm = distanceKm(center, p)
          if (distKm <= radiusKm) found.push({ point: p, distKm })
        }
      }
    }
    return found.sort((a, b) => a.distKm - b.distKm)
  }
}
