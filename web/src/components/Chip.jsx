export default function Chip({ selected, onClick, children }) {
  return (
    <button type="button" className={`chip${selected ? ' selected' : ''}`} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  )
}
