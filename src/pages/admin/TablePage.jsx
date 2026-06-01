import { useEffect, useRef, useState } from 'react'
import AdminTableQrDialog from '../../components/admin/AdminTableQrDialog'
import AdminTableRow from '../../components/admin/AdminTableRow'
import { useStore } from '../../contexts/StoreContext'
import { normalizeTableName } from '../../lib/adminTable'
import { downloadQrPosterPdf } from '../../lib/qrPosterPdf'
import {
  createAdminTable,
  reissueAdminTableQr,
  renameAdminTable,
  subscribeAdminTables,
} from '../../services/adminTableService'

export default function TablePage() {
  const { storeId } = useStore()
  const [tables, setTables] = useState([])
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [qrTarget, setQrTarget] = useState(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [editingTableId, setEditingTableId] = useState(null)
  const [editingTableName, setEditingTableName] = useState('')
  const [savingTableName, setSavingTableName] = useState(false)
  const qrCanvasRef = useRef(null)
  const baseUrl = window.location.origin

  useEffect(() => {
    if (!storeId) return
    return subscribeAdminTables(storeId, setTables)
  }, [storeId])

  async function handleAdd(event) {
    event.preventDefault()
    if (!normalizeTableName(newName)) return
    setAdding(true)
    try {
      await createAdminTable({ storeId, tableName: newName })
      setNewName('')
    } finally {
      setAdding(false)
    }
  }

  async function reissueQr(table) {
    if (!confirm(`「${table.tableName}」のQRを再発行しますか？\n古いQRは使えなくなります。`)) return
    await reissueAdminTableQr(table.id)
    setQrTarget(null)
  }

  function startEditTableName(table) {
    setEditingTableId(table.id)
    setEditingTableName(table.tableName ?? '')
  }

  function cancelEditTableName() {
    setEditingTableId(null)
    setEditingTableName('')
  }

  async function saveTableName(table) {
    const name = normalizeTableName(editingTableName)
    if (!name || savingTableName) return
    setSavingTableName(true)
    try {
      await renameAdminTable(table.id, name)
      cancelEditTableName()
    } finally {
      setSavingTableName(false)
    }
  }

  async function handleDownloadPosterPdf(table) {
    if (generatingPdf) return
    setGeneratingPdf(true)
    try {
      await downloadQrPosterPdf(table, qrCanvasRef.current, baseUrl)
    } catch (error) {
      console.error(error)
      alert('PDFの作成に失敗しました。もう一度お試しください。')
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div>
      <h2 className="admin-page-title">席管理</h2>

      <form onSubmit={handleAdd} className="admin-inline-form">
        <input
          value={newName}
          onChange={event => setNewName(event.target.value)}
          placeholder="席名（例: 1番テーブル）"
          className="admin-text-input"
        />
        <button
          type="submit"
          disabled={adding}
          className="button button-primary admin-form-submit"
        >
          追加
        </button>
      </form>

      <AdminTableQrDialog
        table={qrTarget}
        baseUrl={baseUrl}
        qrCanvasRef={qrCanvasRef}
        generatingPdf={generatingPdf}
        onDownloadPosterPdf={handleDownloadPosterPdf}
        onReissueQr={reissueQr}
        onClose={() => setQrTarget(null)}
      />

      <div className="admin-list-stack">
        {tables.map(table => (
          <AdminTableRow
            key={table.id}
            table={table}
            editing={editingTableId === table.id}
            editingTableName={editingTableName}
            savingTableName={savingTableName}
            onStartEdit={startEditTableName}
            onEditingNameChange={setEditingTableName}
            onSaveName={saveTableName}
            onCancelEdit={cancelEditTableName}
            onShowQr={setQrTarget}
          />
        ))}
        {tables.length === 0 && (
          <p className="admin-empty-state">席がまだありません</p>
        )}
      </div>
    </div>
  )
}
