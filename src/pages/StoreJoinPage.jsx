import { useParams } from 'react-router-dom'
import StoreCodeEntryForm from '../components/staff/StoreCodeEntryForm'
import useStoreCodeEntry from '../hooks/useStoreCodeEntry'
import { STAFF_JOINED_BY_QR_KEY, normalizeStaffStoreCode } from '../lib/staffEntry'

// スタッフの端末で二次元コード（/join/<店舗コード>）を読んだとき（2026-10-23 スタッフ登録）。
// 店舗コードを手で入れずに店へ入り、名前を選ぶ画面へ進む。入れなかったときだけ、手で入れる欄を出す。
export default function StoreJoinPage() {
  const { code } = useParams()
  const normalized = normalizeStaffStoreCode(code ?? '')
  sessionStorage.setItem(STAFF_JOINED_BY_QR_KEY, normalized)
  const entry = useStoreCodeEntry({ autoEnterCode: normalized })

  return (
    <div className="staff-auth">
      <div className="staff-auth__brand">
        <h1 className="staff-auth__title">スタッフ画面</h1>
        <p className="staff-auth__lead">
          {entry.error ? '店に入れませんでした。店舗コードを確かめてください' : '二次元コードの店舗コードで入っています...'}
        </p>
      </div>
      {entry.error && (
        <div className="staff-auth__card">
          <StoreCodeEntryForm entry={entry} autoFocus />
        </div>
      )}
    </div>
  )
}
