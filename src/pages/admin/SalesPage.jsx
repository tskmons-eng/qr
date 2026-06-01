import { useEffect, useMemo, useState } from 'react'
import AdminSalesHeader from '../../components/admin/AdminSalesHeader'
import CashClosingHistory from '../../components/admin/CashClosingHistory'
import CashClosingPanel from '../../components/admin/CashClosingPanel'
import SalesSummaryCards from '../../components/admin/SalesSummaryCards'
import TodayCheckList from '../../components/admin/TodayCheckList'
import { useStore } from '../../contexts/StoreContext'
import { downloadCSV, formatTS } from '../../lib/csv'
import {
  buildSalesExportFilename,
  buildSalesExportRows,
  calculateSalesSummary,
  filterTodayChecks,
  getBusinessDate,
} from '../../lib/adminSales'
import { createCashClosingRecord, loadSalesAdminData } from '../../services/adminSalesService'

export default function SalesPage() {
  const { storeId } = useStore()
  const [todayChecks, setTodayChecks] = useState([])
  const [allChecks, setAllChecks] = useState([])
  const [closings, setClosings] = useState([])
  const [todayClosed, setTodayClosed] = useState(false)
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const businessDate = getBusinessDate()
  const todaySummary = useMemo(() => calculateSalesSummary(todayChecks), [todayChecks])

  useEffect(() => {
    if (!storeId) return undefined
    let cancelled = false

    async function load() {
      setLoading(true)
      const data = await loadSalesAdminData(storeId)
      if (cancelled) return

      setAllChecks(data.completedChecks)
      setTodayChecks(filterTodayChecks(data.completedChecks))
      setClosings(data.cashClosings)
      setTodayClosed(data.cashClosings.some(closing => closing.businessDate === businessDate))
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [businessDate, storeId])

  async function handleClose() {
    if (todayClosed || saving) return
    setSaving(true)
    try {
      const newClosing = await createCashClosingRecord({
        storeId,
        businessDate,
        memo: memo.trim(),
        summary: todaySummary,
      })
      setClosings(prev => [newClosing, ...prev])
      setTodayClosed(true)
    } catch {
      alert('エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  function handleExport() {
    downloadCSV(buildSalesExportRows(allChecks, formatTS), buildSalesExportFilename())
  }

  if (loading) return <div className="admin-sales__loading">読み込み中...</div>

  return (
    <div className="admin-sales">
      <AdminSalesHeader
        exportDisabled={allChecks.length === 0}
        onExport={handleExport}
      />
      <SalesSummaryCards businessDate={businessDate} summary={todaySummary} />
      <TodayCheckList checks={todayChecks} />
      <CashClosingPanel
        memo={memo}
        saving={saving}
        todayClosed={todayClosed}
        onClose={handleClose}
        onMemoChange={setMemo}
      />
      <CashClosingHistory closings={closings} />
    </div>
  )
}
