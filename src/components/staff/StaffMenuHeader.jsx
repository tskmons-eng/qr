export default function StaffMenuHeader({ onBack }) {
  return (
    <div className="staff-menu__header">
      <button type="button" onClick={onBack}>←</button>
      <span>注文追加（スタッフ）</span>
    </div>
  )
}
