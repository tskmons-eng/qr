// 席がまだ無いとき（2026-10-22 古い「管理画面」の案内を直した）。
export default function StaffTableListEmpty() {
  return (
    <div className="staff-table-list-empty">
      <p>席がまだありません</p>
      <p className="staff-table-list-empty__hint">席を作ると、ここに席の一覧が出ます（店舗管理 → 席）</p>
    </div>
  )
}
