export default function AppRouteLoading({ compact = false }) {
  return (
    <div
      className={`app-route-loading${compact ? ' is-compact' : ''}`}
      role="status"
      aria-live="polite"
    >
      読み込み中...
    </div>
  )
}
