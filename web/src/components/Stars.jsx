/** 별점 표시(value) 또는 입력(onChange 가 있으면). 같은 별을 다시 누르면 지운다. */
export default function Stars({ value, onChange, size = 'small' }) {
  if (!onChange) {
    if (!value) return null
    return (
      <span className={`stars stars-${size}`} aria-label={`별점 ${value}점`}>
        {'★'.repeat(value)}
        <span className="stars-empty">{'★'.repeat(5 - value)}</span>
      </span>
    )
  }
  return (
    <div className="stars stars-input" role="radiogroup" aria-label="별점">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n}점`}
          className={n <= (value ?? 0) ? 'on' : ''}
          onClick={() => onChange(value === n ? null : n)}
        >
          ★
        </button>
      ))}
    </div>
  )
}
