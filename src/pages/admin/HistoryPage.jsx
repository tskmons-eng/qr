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
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!storeId) return
    async function load() {
      setLoading(true)
      setItems(await loadAdminHistory(storeId))
      setLoading(false)
    }
    load()
  }, [storeId])

  const filtered = filterHistoryItems(items, filter)

  function handleExport() {
    downloadCSV(buildHistoryExportRows(filtered, formatTS), buildHistoryExportFilename())
  }

  return (
    <div className="admin-history">
      <AdminHistoryHeader
        exportDisabled={filtered.length === 0}
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
      />
    </div>
  )
}
