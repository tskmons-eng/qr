import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { buildStaffJoinUrl } from '../../lib/staffEntry'
import BottomSheet from '../ui/BottomSheet'

// スタッフの端末での入り方（2026-10-23 スタッフ登録）。店舗コードと、読むだけで店舗コードが入る二次元コード。
// 二次元コードは店舗コードと同じ扱いなので、店の外には貼らない。
export default function StaffEntryCard({ storeCode }) {
  const [large, setLarge] = useState(false)
  if (!storeCode) return null
  const joinUrl = buildStaffJoinUrl(storeCode)

  return (
    <>
      <div className="staff-entry-card">
        <button type="button" onClick={() => setLarge(true)} className="staff-entry-card__qr" aria-label="二次元コードを大きく出す">
          <QRCodeSVG value={joinUrl} size={60} />
        </button>
        <div className="staff-entry-card__text">
          <b>スタッフの端末での入り方</b>
          <strong>{storeCode}</strong>
          <span>端末のカメラでこの二次元コードを読むと、店舗コードが入ります。店の外には貼らないでください。</span>
        </div>
        <button type="button" onClick={() => setLarge(true)} className="ui-button ui-button--soft">大きく出す</button>
      </div>
      <BottomSheet open={large} title="スタッフの端末で読む" onClose={() => setLarge(false)}>
        <div className="staff-entry-card__large">
          <QRCodeSVG value={joinUrl} size={240} />
          <strong>{storeCode}</strong>
          <span>読めないときは、スタッフ画面で店舗コードを入れてください。</span>
        </div>
      </BottomSheet>
    </>
  )
}
