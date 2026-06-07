import { useEffect, useRef, useState } from 'react'
import AdminTableGroupsPanel from '../../components/admin/AdminTableGroupsPanel'
import AdminTableQrDialog from '../../components/admin/AdminTableQrDialog'
import AdminTableRow from '../../components/admin/AdminTableRow'
import { useStore } from '../../contexts/StoreContext'
import { getPublicOrderBaseUrl, normalizeTableName } from '../../lib/adminTable'
import { normalizeTableGroupName } from '../../lib/tableGroups'
import { downloadQrPosterPdf } from '../../lib/qrPosterPdf'
import {
  createAdminTable,
  reissueAdminTableQr,
  renameAdminTable,
  subscribeAdminTables,
} from '../../services/adminTableService'
import {
  createTableGroup,
  deleteTableGroupAndClearTables,
  renameTableGroup,
  subscribeTableGroups,
  updateTableGroupAssignment,
} from '../../services/tableGroupService'

export default function TablePage() {
  const { storeId } = useStore()
  const [tables, setTables] = useState([])
  const [groups, setGroups] = useState([])
  const [newName, setNewName] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addingGroup, setAddingGroup] = useState(false)
  const [qrTarget, setQrTarget] = useState(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [editingTableId, setEditingTableId] = useState(null)
  const [editingTableName, setEditingTableName] = useState('')
  const [savingTableName, setSavingTableName] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [editingGroupName, setEditingGroupName] = useState('')
  const qrCanvasRef = useRef(null)
  const baseUrl = getPublicOrderBaseUrl()

  useEffect(() => {
    if (!storeId) return
    return subscribeAdminTables(storeId, setTables)
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    return subscribeTableGroups(storeId, setGroups)
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

  async function handleAddGroup(event) {
    event.preventDefault()
    if (!normalizeTableGroupName(newGroupName)) return
    setAddingGroup(true)
    try {
      await createTableGroup({ storeId, name: newGroupName, sortOrder: groups.length })
      setNewGroupName('')
    } finally {
      setAddingGroup(false)
    }
  }

  function startEditGroup(group) {
    setEditingGroupId(group.id)
    setEditingGroupName(group.name ?? '')
  }

  function cancelEditGroup() {
    setEditingGroupId(null)
    setEditingGroupName('')
  }

  async function saveGroupName(group) {
    const name = normalizeTableGroupName(editingGroupName)
    if (!name) return
    await renameTableGroup(group.id, name)
    cancelEditGroup()
  }

  async function deleteGroup(group) {
    if (!confirm(`「${group.name}」を削除しますか？\nこのグループ内の席は未設定に戻ります。注文や席は削除されません。`)) return
    await deleteTableGroupAndClearTables({ groupId: group.id, storeId })
  }

  return (
    <div>
      <h2 className="admin-page-title">席管理</h2>

      <AdminTableGroupsPanel
        editingGroupId={editingGroupId}
        editingGroupName={editingGroupName}
        groups={groups}
        newGroupName={newGroupName}
        saving={addingGroup}
        onAddGroup={handleAddGroup}
        onCancelEditGroup={cancelEditGroup}
        onDeleteGroup={deleteGroup}
        onEditGroupNameChange={setEditingGroupName}
        onNewGroupNameChange={setNewGroupName}
        onSaveGroupName={saveGroupName}
        onStartEditGroup={startEditGroup}
      />

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
            groups={groups}
            onStartEdit={startEditTableName}
            onEditingNameChange={setEditingTableName}
            onSaveName={saveTableName}
            onCancelEdit={cancelEditTableName}
            onShowQr={setQrTarget}
            onGroupChange={(tableId, groupId) => updateTableGroupAssignment({ tableId, groupId })}
          />
        ))}
        {tables.length === 0 && (
          <p className="admin-empty-state">席がまだありません</p>
        )}
      </div>
    </div>
  )
}
