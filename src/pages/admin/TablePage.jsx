import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TableAddSheet from '../../components/admin/TableAddSheet'
import TableQrPrintSheet from '../../components/admin/TableQrPrintSheet'
import TableSetupList from '../../components/admin/TableSetupList'
import TableSheet from '../../components/admin/TableSheet'
import { useStore } from '../../contexts/StoreContext'
import useTableAdmin from '../../hooks/useTableAdmin'
import useTouchReorder from '../../hooks/useTouchReorder'
import { getPublicOrderBaseUrl } from '../../lib/adminTable'

// 席の管理（2026-10-23 席設計で作り直し）。1席1行、つまんで店の並びどおりに並べ替える。
// 名前の変更・QR・削除は席を押したシートで、追加は「＋ 席」のシート（番号でまとめて作れる）。グループは無くした。
export default function TablePage() {
  const { storeId } = useStore()
  const admin = useTableAdmin(storeId)
  const [openTableId, setOpenTableId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [listError, setListError] = useState('')
  const [printing, setPrinting] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const reorder = useTouchReorder(async (type, dragId, targetId) => handleReorder(dragId, targetId))
  const baseUrl = getPublicOrderBaseUrl()
  // シートは最新の席を見る（QR を作り直したとき・お客様が座ったときにすぐ変わる）。
  const openTable = admin.tables.find(table => table.id === openTableId) ?? null

  // 「はじめの準備」の「QRを印刷」から来たときは、まとめて印刷のシートを開く。
  useEffect(() => {
    if (searchParams.get('print') !== '1') return
    setPrinting(true)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  async function handleReorder(dragId, targetId) {
    setListError((await admin.reorderTables(dragId, targetId)) ?? '')
  }

  return (
    <div className="table-admin">
      <div className="table-admin__bar">
        <span className="table-admin__hint">{admin.tables.length > 1 ? '⋮⋮ をつまんで、店の並びどおりに' : '席を作ると、ここに並びます'}</span>
        <span className="table-admin__count">{admin.tables.length}席</span>
        <button type="button" onClick={() => setAdding(true)} className="ui-button ui-button--primary">＋ 席</button>
      </div>
      {admin.tables.length > 0 && (
        <button type="button" onClick={() => setPrinting(true)} className="table-admin__print">
          <span className="table-admin__print-icon" aria-hidden="true">印</span>
          <span className="table-admin__print-text">
            <b>全部の席のQRをまとめて印刷</b>
            <small>A4に8席分・{admin.tables.length}席で{Math.ceil(admin.tables.length / 8)}枚</small>
          </span>
          <span className="table-admin__print-go">PDF ›</span>
        </button>
      )}
      {(admin.loadError || listError) && <p className="table-sheet__error" role="alert">{admin.loadError || listError}</p>}
      {admin.loading ? (
        <p className="table-admin__empty">読み込み中...</p>
      ) : admin.tables.length === 0 ? (
        <p className="table-admin__empty">まだ席がありません。「＋ 席」から、番号でまとめて作れます。</p>
      ) : (
        <TableSetupList
          tables={admin.tables}
          touchDrag={reorder.touchDrag}
          reorderHandlers={{
            onDrop: handleReorder,
            onTouchStart: reorder.startTouchReorder,
            onTouchMove: reorder.moveTouchReorder,
            onTouchEnd: reorder.finishTouchReorder,
            onTouchCancel: reorder.cancelTouchReorder,
          }}
          onOpenTable={table => setOpenTableId(table.id)}
        />
      )}
      {printing && <TableQrPrintSheet tables={admin.tables} baseUrl={baseUrl} onClose={() => setPrinting(false)} />}
      {adding && <TableAddSheet tables={admin.tables} onAdd={admin.addTables} onClose={() => setAdding(false)} />}
      {openTable && (
        <TableSheet
          key={openTable.id}
          table={openTable}
          baseUrl={baseUrl}
          onRename={admin.renameTable}
          onReissueQr={admin.reissueQr}
          onDelete={admin.deleteTable}
          onClose={() => setOpenTableId(null)}
        />
      )}
    </div>
  )
}
