import { useCallback, useState } from 'react'
import { useCouple } from '../CoupleProvider.jsx'
import { getCurrentPlace } from '../currentLocation.js'
import {
  NOVELTY_OPTIONS,
  RADIUS_OPTIONS,
  REC_COUNT_MAX,
  REC_COUNT_MIN,
  THEMES,
  saveSetting,
  withDefaults,
} from '../settings.js'
import BaseMap from './BaseMap.jsx'
import Chip from './Chip.jsx'
import PlacePicker from './PlacePicker.jsx'

/** 설정 탭의 데이트 취향 (커플 공유, 항목별 즉시 저장) */
export default function DatePreferences() {
  const { couple } = useCouple()
  const settings = withDefaults(couple.settings)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState(null)

  const save = useCallback(
    (key, value) => {
      setError(null)
      saveSetting(couple.id, key, value).catch((e) => {
        console.error(e)
        setError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      })
    },
    [couple.id],
  )

  const handleSelectBase = useCallback(
    (place) => {
      save('base', place)
      setPicking(false)
    },
    [save],
  )
  const closePicker = useCallback(() => setPicking(false), [])

  const [locating, setLocating] = useState(false)
  async function handleCurrentLocation() {
    setLocating(true)
    setError(null)
    try {
      save('base', await getCurrentPlace())
    } catch (e) {
      setError(e.message)
    } finally {
      setLocating(false)
    }
  }

  function toggleTheme(theme) {
    const next = settings.themes.includes(theme)
      ? settings.themes.filter((t) => t !== theme)
      : THEMES.filter((t) => t === theme || settings.themes.includes(t)) // 표시 순서 유지
    save('themes', next)
  }

  const novelty = NOVELTY_OPTIONS.find((o) => o.value === settings.novelty) ?? NOVELTY_OPTIONS[0]

  return (
    <>
      <div className="card">
        <p className="card-label">기준 위치</p>
        {settings.base ? (
          <>
            <div className="row">
              <div className="grow">
                <p className="strong">{settings.base.name}</p>
                <p className="muted small">{settings.base.address}</p>
              </div>
            </div>
            <BaseMap lat={settings.base.lat} lng={settings.base.lng} radiusKm={settings.radiusKm} />
          </>
        ) : (
          <p className="muted small">이 위치를 중심으로 가까운 데이트 코스를 추천해요. 주로 만나는 동네를 지정해 주세요.</p>
        )}
        <div className="button-row">
          <button type="button" className="btn btn-primary" onClick={() => setPicking(true)}>
            🔍 {settings.base ? '위치 변경' : '위치 검색'}
          </button>
          <button type="button" className="btn" onClick={handleCurrentLocation} disabled={locating}>
            📍 {locating ? '확인 중…' : '현재 위치'}
          </button>
        </div>
      </div>

      <div className="card">
        <p className="card-label">이동 반경</p>
        <div className="chips" role="group" aria-label="이동 반경">
          {RADIUS_OPTIONS.map((o) => (
            <Chip key={o.label} selected={settings.radiusKm === o.value} onClick={() => save('radiusKm', o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="card">
        <p className="card-label">좋아하는 데이트</p>
        <p className="muted small">여러 개 고를 수 있어요. 아무것도 고르지 않으면 모든 종류를 고르게 추천해요.</p>
        <div className="chips" role="group" aria-label="좋아하는 데이트">
          {THEMES.map((t) => (
            <Chip key={t} selected={settings.themes.includes(t)} onClick={() => toggleTheme(t)}>
              {t}
            </Chip>
          ))}
        </div>
      </div>

      <div className="card">
        <p className="card-label">새로운 시도</p>
        <div className="chips" role="group" aria-label="새로운 시도 빈도">
          {NOVELTY_OPTIONS.map((o) => (
            <Chip key={o.value} selected={novelty.value === o.value} onClick={() => save('novelty', o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>
        <p className="muted small">{novelty.hint}</p>
      </div>

      <div className="card row">
        <div className="grow">
          <p className="card-label">주간 추천 개수</p>
          <p className="muted small">매주 월요일에 받을 코스 수</p>
        </div>
        <div className="stepper">
          <button
            type="button"
            className="icon-btn"
            onClick={() => save('recCount', settings.recCount - 1)}
            disabled={settings.recCount <= REC_COUNT_MIN}
            aria-label="줄이기"
          >
            −
          </button>
          <span className="stepper-value" aria-live="polite">
            {settings.recCount}개
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => save('recCount', settings.recCount + 1)}
            disabled={settings.recCount >= REC_COUNT_MAX}
            aria-label="늘리기"
          >
            +
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {picking && <PlacePicker title="기준 위치 검색" onSelect={handleSelectBase} onClose={closePicker} />}
    </>
  )
}
