import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import AdminSalesHeader from '../../components/admin/AdminSalesHeader'
import CashClosingHistory from '../../components/admin/CashClosingHistory'
import CashClosingPanel from '../../components/admin/CashClosingPanel'
import SalesAssigneeManagerModal from '../../components/admin/SalesAssigneeManagerModal'
import SalesCheckDetailModal from '../../components/admin/SalesCheckDetailModal'
import SalesHistoryView from '../../components/admin/SalesHistoryView'
import SalesSummaryCards from '../../components/admin/SalesSummaryCards'
import TodayCheckList from '../../components/admin/TodayCheckList'
import { useAuth } from '../../contexts/AuthContext'
import { useStaffMember } from '../../contexts/StaffMemberContext'
import { useStore } from '../../contexts/StoreContext'
import { downloadCSV } from '../../lib/csv'
import {
  buildAssigneeSummaryExportRows,
  buildAttributedSalesExportRows,
  buildSalesExportFilename,
  buildSalesExportRows,
  calculateAttributionSummary,
  calculateSalesSummary,
  filterChecksByAssignee,
  filterChecksByDateRange,
  filterTodayChecks,
  formatSalesTimestamp,
  getBusinessDate,
  getMonthDateRange,
  joinChecksWithAttributions,
  sortChecksByCompletedAtDesc,
} from '../../lib/adminSales'
import { hasStaffPermission } from '../../lib/staffPermissions'
import { createCashClosingRecord, loadSalesAdminData } from '../../services/adminSalesService'
import {
  createSalesAssignee,
  saveSalesAttribution,
  updateSalesAssignee,
} from '../../services/salesHistoryService'

const PAGE_SIZE = 50
const ELEVATED_PERMISSION_DEFAULTS = {
  useKitchen: true,
  closeRegister: false,
  manageMenu: false,
  manageTables: false,
  manageReservations: false,
  viewHistory: false,
  manageSettings: false,
  manageStaff: false,
}

function getMonthKey(date = new Date()) {
  return getBusinessDate(date).slice(0, 7)
}

function parseMonthKey(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '')
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return new Date(year, month - 1, 1, 12)
}

function filenameDate() {
  return getBusinessDate().replaceAll('-', '')
}

function sanitizeFilenamePart(value) {
  return String(value ?? '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_')
}

function errorMessage(error, fallback) {
  return error?.message || fallback
}

export default function SalesPage() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const staffContext = useStaffMember()
  const activeStaff = staffContext?.activeStaff ?? null
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [allChecks, setAllChecks] = useState([])
  const [closings, setClosings] = useState([])
  const [assignees, setAssignees] = useState([])
  const [attributions, setAttributions] = useState([])
  const [todayClosed, setTodayClosed] = useState(false)
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [savingClosing, setSavingClosing] = useState(false)
  const [closingError, setClosingError] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedCheckId, setSelectedCheckId] = useState(null)
  const [detailSaving, setDetailSaving] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailSuccess, setDetailSuccess] = useState('')
  const [managerOpen, setManagerOpen] = useState(false)
  const [managerSaving, setManagerSaving] = useState(false)
  const [managerError, setManagerError] = useState('')
  const [managerSuccess, setManagerSuccess] = useState('')

  const businessDate = getBusinessDate()
  const activeView = searchParams.get('view') === 'history' ? 'history' : 'today'
  const periodMode = ['range', 'all'].includes(searchParams.get('period'))
    ? searchParams.get('period')
    : 'month'
  const monthKey = parseMonthKey(searchParams.get('month'))
    ? searchParams.get('month')
    : getMonthKey()
  const monthRange = getMonthDateRange(parseMonthKey(monthKey) ?? new Date())
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('from') ?? '')
    ? searchParams.get('from')
    : monthRange.startDate
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('to') ?? '')
    ? searchParams.get('to')
    : monthRange.endDate
  const assigneeFilter = searchParams.get('assignee') || 'all'
  const isStaffSales = location.pathname.startsWith('/staff/')
  const canManageAssignees = isStaffSales
    ? hasStaffPermission(activeStaff, 'manageStaff', ELEVATED_PERMISSION_DEFAULTS)
    : Boolean(user && !user.isAnonymous)

  const applyLoadedData = useCallback(data => {
    setAllChecks(data.completedChecks)
    setClosings(data.cashClosings)
    setAssignees(data.salesAssignees ?? [])
    setAttributions(data.salesAttributions ?? [])
    setTodayClosed(data.cashClosings.some(closing => closing.businessDate === getBusinessDate()))
  }, [])

  const refreshData = useCallback(async ({ showLoading = false } = {}) => {
    if (!storeId) return null
    if (showLoading) setLoading(true)
    setLoadError('')
    try {
      const data = await loadSalesAdminData(storeId)
      applyLoadedData(data)
      return data
    } catch (error) {
      setLoadError(errorMessage(error, '売上データを取得できませんでした。'))
      throw error
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [applyLoadedData, storeId])

  useEffect(() => {
    if (!storeId) return undefined
    let cancelled = false
    setLoading(true)
    setLoadError('')

    loadSalesAdminData(storeId)
      .then(data => {
        if (!cancelled) applyLoadedData(data)
      })
      .catch(error => {
        if (!cancelled) setLoadError(errorMessage(error, '売上データを取得できませんでした。'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [applyLoadedData, storeId])

  const joinedChecks = useMemo(
    () => joinChecksWithAttributions(allChecks, attributions, assignees),
    [allChecks, assignees, attributions]
  )
  const todayChecks = useMemo(() => filterTodayChecks(joinedChecks), [joinedChecks])
  const todaySummary = useMemo(() => calculateSalesSummary(todayChecks), [todayChecks])
  const periodChecks = useMemo(() => {
    if (periodMode === 'all') return joinedChecks
    const range = periodMode === 'month' ? monthRange : { startDate, endDate }
    return filterChecksByDateRange(joinedChecks, range)
  }, [endDate, joinedChecks, monthRange.endDate, monthRange.startDate, periodMode, startDate])
  const attributionSummary = useMemo(
    () => calculateAttributionSummary(periodChecks, assignees),
    [assignees, periodChecks]
  )
  const filteredHistoryChecks = useMemo(
    () => sortChecksByCompletedAtDesc(filterChecksByAssignee(periodChecks, assigneeFilter)),
    [assigneeFilter, periodChecks]
  )
  const visibleHistoryChecks = filteredHistoryChecks.slice(0, visibleCount)
  const selectedCheck = joinedChecks.find(check => check.id === selectedCheckId) ?? null
  const displayedChecks = activeView === 'history' ? filteredHistoryChecks : todayChecks
  const displayedSummary = useMemo(
    () => calculateAttributionSummary(activeView === 'history' ? periodChecks : todayChecks, assignees),
    [activeView, assignees, periodChecks, todayChecks]
  )

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [assigneeFilter, endDate, monthKey, periodMode, startDate])

  function updateParams(patch) {
    const next = new URLSearchParams(searchParams)
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') next.delete(key)
      else next.set(key, value)
    })
    setSearchParams(next)
  }

  function handleViewChange(view) {
    updateParams({ view: view === 'history' ? 'history' : null })
  }

  function handlePeriodModeChange(mode) {
    if (mode === 'month') updateParams({ period: null, month: monthKey })
    else if (mode === 'range') updateParams({ period: 'range', from: startDate, to: endDate })
    else updateParams({ period: 'all' })
  }

  function handleMonthMove(delta) {
    const current = parseMonthKey(monthKey) ?? new Date()
    const next = new Date(current.getFullYear(), current.getMonth() + delta, 1, 12)
    updateParams({ month: getMonthKey(next), period: null })
  }

  function handleDateRangeChange(range) {
    updateParams({ period: 'range', from: range.startDate, to: range.endDate })
  }

  function handleClosingDrilldown(date) {
    updateParams({ view: 'history', period: 'range', from: date, to: date, assignee: null })
  }

  function handleSelectCheck(check) {
    setSelectedCheckId(check.id)
    setDetailError('')
    setDetailSuccess('')
  }

  async function handleClose() {
    if (todayClosed || savingClosing) return
    setSavingClosing(true)
    setClosingError('')
    try {
      const newClosing = await createCashClosingRecord({
        storeId,
        businessDate,
        memo: memo.trim(),
        summary: todaySummary,
      })
      setClosings(previous => [newClosing, ...previous])
      setTodayClosed(true)
    } catch (error) {
      setClosingError(errorMessage(error, 'レジ締めを完了できませんでした。内容を確認して再試行してください。'))
    } finally {
      setSavingClosing(false)
    }
  }

  async function handleSaveAttribution(assigneeId) {
    if (!selectedCheck || detailSaving) return
    setDetailSaving(true)
    setDetailError('')
    setDetailSuccess('')
    try {
      const assignee = assigneeId ? assignees.find(item => item.id === assigneeId) : null
      if (assigneeId && !assignee) throw new Error('選択した担当者が見つかりません。')
      const savedAttribution = await saveSalesAttribution({
        storeId,
        checkId: selectedCheck.id,
        assignee,
        activeStaff,
      })
      if (savedAttribution.persisted !== false) {
        setAttributions(previous => [
          ...previous.filter(item => (item.checkId ?? item.id) !== selectedCheck.id),
          savedAttribution,
        ])
      }
      setDetailSuccess(assignee ? `担当を「${assignee.name}」に設定しました。` : '担当を解除しました。')
    } catch (error) {
      setDetailError(errorMessage(error, '担当を保存できませんでした。'))
    } finally {
      setDetailSaving(false)
    }
  }

  async function handleCreateAssignee(name) {
    setManagerSaving(true)
    setManagerError('')
    setManagerSuccess('')
    try {
      const createdAssignee = await createSalesAssignee({ storeId, name, activeStaff })
      setAssignees(previous => [...previous, createdAssignee].sort((a, b) => (
        Number(b.isActive !== false) - Number(a.isActive !== false)
        || String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ja')
      )))
      setManagerSuccess(`担当者「${name}」を追加しました。`)
    } catch (error) {
      setManagerError(errorMessage(error, '担当者を追加できませんでした。'))
      throw error
    } finally {
      setManagerSaving(false)
    }
  }

  async function handleUpdateAssignee(assignee, patch) {
    setManagerSaving(true)
    setManagerError('')
    setManagerSuccess('')
    try {
      const updatedAssignee = await updateSalesAssignee({
        storeId,
        assigneeId: assignee.id,
        name: patch.name,
        isActive: patch.isActive,
        activeStaff,
      })
      setAssignees(previous => previous.map(item => (
        item.id === assignee.id ? { ...item, ...updatedAssignee } : item
      )).sort((a, b) => (
        Number(b.isActive !== false) - Number(a.isActive !== false)
        || String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ja')
      )))
      const nextIsActive = patch.isActive ?? assignee.isActive !== false
      const nextName = patch.name ?? assignee.name
      const activeChanged = (assignee.isActive !== false) !== nextIsActive
      setManagerSuccess(activeChanged
        ? `「${nextName}」を${nextIsActive ? '再有効化' : '無効に'}しました。`
        : `担当者名を「${nextName}」に変更しました。`)
    } catch (error) {
      setManagerError(errorMessage(error, '担当者を更新できませんでした。'))
      throw error
    } finally {
      setManagerSaving(false)
    }
  }

  function handleExportAll() {
    downloadCSV(buildSalesExportRows(allChecks, formatSalesTimestamp), buildSalesExportFilename())
  }

  function handleExportFiltered() {
    const periodLabel = activeView === 'today'
      ? businessDate.replaceAll('-', '')
      : periodMode === 'all'
        ? '全期間'
        : periodMode === 'range'
          ? `${startDate.replaceAll('-', '')}-${endDate.replaceAll('-', '')}`
          : monthKey.replaceAll('-', '')
    const selectedAssignee = assignees.find(item => item.id === assigneeFilter)
    const assigneeLabel = activeView === 'today'
      ? '全担当'
      : assigneeFilter === 'unassigned'
        ? '担当未設定'
        : selectedAssignee?.name ?? '全担当'
    downloadCSV(
      buildAttributedSalesExportRows(displayedChecks, formatSalesTimestamp),
      `表示中の会計_${periodLabel}_${sanitizeFilenamePart(assigneeLabel)}_${filenameDate()}.csv`
    )
  }

  function handleExportAssigneeSummary() {
    const periodLabel = activeView === 'today'
      ? businessDate.replaceAll('-', '')
      : periodMode === 'all'
        ? '全期間'
        : periodMode === 'range'
          ? `${startDate.replaceAll('-', '')}-${endDate.replaceAll('-', '')}`
          : monthKey.replaceAll('-', '')
    downloadCSV(
      buildAssigneeSummaryExportRows(displayedSummary),
      `担当別売上_${periodLabel}_${filenameDate()}.csv`
    )
  }

  return (
    <div className="admin-sales">
      <AdminSalesHeader
        activeView={activeView}
        allExportDisabled={allChecks.length === 0}
        canManageAssignees={canManageAssignees}
        filteredExportDisabled={displayedChecks.length === 0}
        summaryExportDisabled={displayedSummary.checkCount === 0}
        onExportAll={handleExportAll}
        onExportAssigneeSummary={handleExportAssigneeSummary}
        onExportFiltered={handleExportFiltered}
        onManageAssignees={() => {
          setManagerError('')
          setManagerSuccess('')
          setManagerOpen(true)
        }}
        onViewChange={handleViewChange}
      />

      {loading ? (
        <div className="admin-sales-state-card" role="status">売上データを読み込み中…</div>
      ) : loadError ? (
        <div className="admin-sales-state-card is-error" role="alert">
          <strong>売上データを取得できませんでした</strong>
          <span>{loadError}</span>
          <button type="button" onClick={() => refreshData({ showLoading: true }).catch(() => {})}>再試行</button>
        </div>
      ) : activeView === 'today' ? (
        <>
          <SalesSummaryCards businessDate={businessDate} summary={todaySummary} />
          <TodayCheckList checks={todayChecks} onSelectCheck={handleSelectCheck} />
          <CashClosingPanel
            businessDate={businessDate}
            error={closingError}
            memo={memo}
            saving={savingClosing}
            summary={todaySummary}
            todayClosed={todayClosed}
            onClose={handleClose}
            onMemoChange={setMemo}
          />
          <CashClosingHistory closings={closings} onSelectDate={handleClosingDrilldown} />
        </>
      ) : (
        <SalesHistoryView
          assigneeFilter={assigneeFilter}
          assignees={assignees}
          checks={visibleHistoryChecks}
          endDate={endDate}
          hasMore={visibleCount < filteredHistoryChecks.length}
          monthKey={monthKey}
          periodMode={periodMode}
          startDate={startDate}
          summary={attributionSummary}
          totalCount={filteredHistoryChecks.length}
          onAssigneeFilterChange={value => updateParams({ assignee: value === 'all' ? null : value })}
          onDateRangeChange={handleDateRangeChange}
          onLoadMore={() => setVisibleCount(count => count + PAGE_SIZE)}
          onMonthMove={handleMonthMove}
          onPeriodModeChange={handlePeriodModeChange}
          onSelectCheck={handleSelectCheck}
        />
      )}

      <SalesCheckDetailModal
        assignees={assignees}
        check={selectedCheck}
        error={detailError}
        saving={detailSaving}
        successMessage={detailSuccess}
        onClose={() => setSelectedCheckId(null)}
        onSaveAttribution={handleSaveAttribution}
      />
      <SalesAssigneeManagerModal
        assignees={assignees}
        error={managerError}
        open={managerOpen}
        saving={managerSaving}
        successMessage={managerSuccess}
        onClose={() => setManagerOpen(false)}
        onCreate={handleCreateAssignee}
        onUpdate={handleUpdateAssignee}
      />
    </div>
  )
}
