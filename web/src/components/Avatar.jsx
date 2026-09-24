export default function Avatar({ name, photoURL, size = 40 }) {
  const style = { width: size, height: size, fontSize: size * 0.42 }
  if (photoURL) {
    // 구글 프로필 이미지는 referrer가 있으면 403이 날 수 있다
    return <img className="avatar" src={photoURL} alt="" style={style} referrerPolicy="no-referrer" />
  }
  return (
    <span className="avatar avatar-fallback" style={style} aria-hidden="true">
      {(name || '?').slice(0, 1)}
    </span>
  )
}
