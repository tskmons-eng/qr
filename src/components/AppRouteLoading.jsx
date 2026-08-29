export default function AppRouteLoading({ compact = false }) {
  return (
    <div
      className={`app-route-loading${compact ? ' is-compact' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="app-route-loading__mark" aria-hidden="true" />
      <span>読み込み中</span>
    </div>
  )
}
