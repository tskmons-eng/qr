export default function StaffPullRefreshIndicator({ phase, text }) {
  return (
    <div className="staff-shell__pull-refresh" aria-hidden={phase === 'idle'}>
      <div className="staff-shell__pull-refresh-badge">
        <span className="staff-shell__pull-refresh-ring" aria-hidden="true" />
        <span>{text}</span>
      </div>
    </div>
  )
}
