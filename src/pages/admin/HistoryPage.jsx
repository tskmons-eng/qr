import { useEffect, useState } from 'react'
import AdminHistoryFilters from '../../components/admin/AdminHistoryFilters'
import AdminHistoryHeader from '../../components/admin/AdminHistoryHeader'
import AdminHistoryList from '../../components/admin/AdminHistoryList'
import { useStore } from '../../contexts/StoreContext'
import { downloadCSV, formatTS } from '../../lib/csv'
import {
  buildHistoryExportFilename,
  buildHistoryExportRows,
  filterHistoryItems,
  HISTORY_FILTER_KEYS,
} from '../../lib/adminHistory'
import { loadAdminHistory } from '../../services/adminHistoryService'

export default function HistoryPage() {
  const { storeId } = useStore()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true

    if (!storeId) {
      setItems([])
      setLoading(false)
      setError('')
      return undefined
    }

    async function load() {
      setLoading(true)
      setError('')

      try {
        const nextItems = await loadAdminHistory(storeId)
        if (active) setItems(nextItems)
      } catch (loadError) {
        console.error('Failed to load admin history', loadError)
        if (active) {
          setItems([])
          setError('操作ログを読み込めませんでした。通信状態を確認して再試行してください。')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [reloadToken, storeId])

  const filtered = filterHistoryItems(items, filter)

  function handleExport() {
    downloadCSV(buildHistoryExportRows(filtered, formatTS), buildHistoryExportFilename())
  }

  return (
    <div className="admin-history">
      <AdminHistoryHeader
        exportDisabled={loading || Boolean(error) || filtered.length === 0}
        onExport={handleExport}
      />
      <AdminHistoryFilters
        filter={filter}
        filterKeys={HISTORY_FILTER_KEYS}
        onFilterChange={setFilter}
      />
      <AdminHistoryList
        items={filtered}
        loading={loading}
        error={error}
        emptyMessage={items.length === 0 ? '操作ログはまだありません' : 'この条件に一致する操作ログはありません'}
        onRetry={() => setReloadToken(token => token + 1)}
      />
    </div>
  )
}
