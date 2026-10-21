import StoreCodeEntryForm from '../../components/staff/StoreCodeEntryForm'
import useStoreCodeEntry from '../../hooks/useStoreCodeEntry'

// 最初の入室画面。保存済みの店舗コードがあれば自動で入る。
export default function StaffEntryPage() {
  const entry = useStoreCodeEntry({ autoEnterSaved: true })

  return (
    <div className="staff-auth">
      <div className="staff-auth__brand">
        <h1 className="staff-auth__title">スタッフ画面</h1>
        <p className="staff-auth__lead">
          {entry.autoEntering ? '保存済みの店舗コードで入室しています...' : '店舗コードを入力してください'}
        </p>
      </div>
      <div className="staff-auth__card">
        <StoreCodeEntryForm entry={entry} autoFocus />
      </div>
    </div>
  )
}
