import { useState } from 'react'
import TableAddSheet from '../../components/admin/TableAddSheet'
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
  const reorder = useTouchReorder(async (type, dragId, targetId) => handleReorder(dragId, targetId))
  const baseUrl = getPublicOrderBaseUrl()
  // シートは最新の席を見る（QR を作り直したとき・お客様が座ったときにすぐ変わる）。
  const openTable = admin.tables.find(table => table.id === openTableId) ?? null

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
