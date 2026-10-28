// スタッフの注文追加の上の帯（2026-10-28 注文の流れ 第2章）。席名・人数・経過を出し、右に「席へ戻る」。
export default function StaffMenuHeader({ tableName = '', guestCount = 0, elapsed = '', onBack }) {
  const place = [tableName, guestCount > 0 ? `${guestCount}名` : '', elapsed].filter(Boolean).join('・')
  return (
    <div className="staff-menu__header">
      <div className="staff-menu__heading">
        {place && <small>{place}</small>}
        <b>注文を追加</b>
      </div>
      <button type="button" onClick={onBack}>席へ戻る</button>
    </div>
  )
}
