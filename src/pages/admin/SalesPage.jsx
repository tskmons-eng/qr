import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import AdminSalesHeader from '../../components/admin/AdminSalesHeader'
import CheckCorrectionScreen from '../../components/admin/CheckCorrectionScreen'
import CheckVoidSheet from '../../components/admin/CheckVoidSheet'
import SalesAssigneeManagerModal from '../../components/admin/SalesAssigneeManagerModal'
import SalesCheckDetailModal from '../../components/admin/SalesCheckDetailModal'
import SalesHistoryView from '../../components/admin/SalesHistoryView'
import SalesTodayView from '../../components/admin/SalesTodayView'
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
  filterChecksByAssignee,
  filterChecksByDateRange,
  filterTodayChecks,
  formatSalesTimestamp,
  getBusinessDate,
  getMonthDateRange,
  joinChecksWithAttributions,
  sortChecksByCompletedAtDesc,
  toTimestampDate,
} from '../../lib/adminSales'
import { summarizeChecksForClosing } from '../../lib/closingSummary'
import { createOrderCommandRequestId } from '../../lib/orderCommands'
import { formatOrderCommandError, logOrderCommandError } from '../../lib/orderCommandErrors'
import { normalizeStoreConfig } from '../../lib/settingsConfig'
import { hasStaffPermission } from '../../lib/staffPermissions'
import useNow from '../../hooks/useNow'
import useSalesAssigneeManager from '../../hooks/useSalesAssigneeManager'
import { loadSalesAdminData } from '../../services/adminSalesService'
import { closeRegisterCommand, voidCheckCommand } from '../../services/orderCommandService'
import { saveSalesAttribution } from '../../services/salesHistoryService'
import { loadStoreConfig } from '../../services/settingsService'

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

// その営業日の東京の正午（本日の会計を選ぶときの基準の日時）。
function businessDayNoon(businessDate) {
  return new Date(`${businessDate}T12:00:00+09:00`)
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
  const [voidedChecks, setVoidedChecks] = useState([])
  const [closings, setClosings] = useState([])
  const [assignees, setAssignees] = useState([])
  const [attributions, setAttributions] = useState([])
  const [memo, setMemo] = useState('')
  const [openingCash, setOpeningCash] = useState('')
  const [countedCash, setCountedCash] = useState('')
  const [voidTarget, setVoidTarget] = useState(null)
  const [voidError, setVoidError] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [correction, setCorrection] = useState(null)
  // 締めを押し直したとき（返事が届かなかったとき）に同じ要求として送り、二重の締めにも失敗にもしない。
  const closeRequestIdRef = useRef(null)
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
  const assigneeManager = useSalesAssigneeManager({ storeId, activeStaff, setAssignees })

  // 画面を開いたまま日付が変わったら、本日の一覧・集計・締めを新しい日に切り替える（2026-10-30 レビュー）。
  const now = useNow(60000)
  const businessDate = getBusinessDate(new Date(now))
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
    setVoidedChecks(data.voidedChecks ?? [])
    setClosings(data.cashClosings)
    setAssignees(data.salesAssignees ?? [])
    setAttributions(data.salesAttributions ?? [])
    // 始めに入れたお釣りは、前の締めの額を初めの値にする（毎日同じ額のことが多い）。
    const lastOpening = data.cashClosings.find(closing => Number.isFinite(Number(closing.openingCash)) && closing.openingCash !== null)
    setOpeningCash(previous => previous || (lastOpening ? String(lastOpening.openingCash) : ''))
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

  // 日付が変わったら読み込み直し、前の日の現金の入力と締めの要求を消す。
  const businessDateRef = useRef(businessDate)
  useEffect(() => {
    if (businessDateRef.current === businessDate) return
    businessDateRef.current = businessDate
    setCountedCash('')
    setMemo('')
    setClosingError('')
    closeRequestIdRef.current = null
    refreshData().catch(() => {})
  }, [businessDate, refreshData])

  const joinedChecks = useMemo(
    () => joinChecksWithAttributions(allChecks, attributions, assignees),
    [allChecks, assignees, attributions]
  )
  const todayChecks = useMemo(() => filterTodayChecks(joinedChecks, businessDayNoon(businessDate)), [businessDate, joinedChecks])
  const todayVoidedChecks = useMemo(() => filterTodayChecks(voidedChecks, businessDayNoon(businessDate)), [businessDate, voidedChecks])
  const todaySummary = useMemo(
    () => summarizeChecksForClosing([...todayChecks, ...todayVoidedChecks]),
    [todayChecks, todayVoidedChecks]
  )
  const todayClosing = closings.find(closing => closing.businessDate === businessDate) ?? null
  const closedDates = useMemo(() => new Set(closings.map(closing => closing.businessDate)), [closings])
  const periodChecks = useMemo(() => {
    if (periodMode === 'all') return joinedChecks
    const range = periodMode === 'month' ? monthRange : { startDate, endDate }
    return filterChecksByDateRange(joinedChecks, range)
  }, [endDate, joinedChecks, monthRange.endDate, monthRange.startDate, periodMode, startDate])
  const periodRange = periodMode === 'all' ? {} : periodMode === 'month' ? monthRange : { startDate, endDate }
  const periodVoidedChecks = useMemo(
    () => filterChecksByDateRange(voidedChecks, periodRange),
    [periodRange.endDate, periodRange.startDate, voidedChecks] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const periodClosings = useMemo(
    () => closings.filter(closing => (!periodRange.startDate || closing.businessDate >= periodRange.startDate)
      && (!periodRange.endDate || closing.businessDate <= periodRange.endDate)),
    [closings, periodRange.endDate, periodRange.startDate] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const attributionSummary = useMemo(
    () => calculateAttributionSummary(periodChecks, assignees),
    [assignees, periodChecks]
  )
  const filteredHistoryChecks = useMemo(
    () => sortChecksByCompletedAtDesc(filterChecksByAssignee(periodChecks, assigneeFilter)),
    [assigneeFilter, periodChecks]
  )
  // 取り消した会計は担当で絞っていないときだけ一覧と集計に出す（担当は付いていないため）。
  const historyListChecks = useMemo(
    () => (assigneeFilter === 'all'
      ? sortChecksByCompletedAtDesc([...filteredHistoryChecks, ...periodVoidedChecks])
      : filteredHistoryChecks),
    [assigneeFilter, filteredHistoryChecks, periodVoidedChecks]
  )
  const historySummary = useMemo(() => summarizeChecksForClosing(historyListChecks), [historyListChecks])
  const historySummaryTitle = assigneeFilter === 'all'
    ? '期間の売上'
    : assigneeFilter === 'unassigned'
      ? '担当未設定の売上'
      : `${assignees.find(item => item.id === assigneeFilter)?.name ?? '担当'}の売上`
  const visibleHistoryChecks = historyListChecks.slice(0, visibleCount)
  const selectedCheck = joinedChecks.find(check => check.id === selectedCheckId)
    ?? voidedChecks.find(check => check.id === selectedCheckId)
    ?? null
  // 締めた日の会計は直せない（締めの数字が後から変わらないように。サーバーでも断る）。
  const selectedCheckDate = selectedCheck ? getBusinessDate(toTimestampDate(selectedCheck.completedAt) ?? new Date()) : null
  const correctionLockedMessage = selectedCheckDate && closedDates.has(selectedCheckDate)
    ? 'この日はもう締めてあるので、打ち直し・取り消しはできません。'
    : ''
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

  // 締めはサーバーがその日の会計を数え直して残す（2026-10-30 締め 第2章）。終わったら読み込み直して、残った記録を見せる。
  async function handleClose() {
    if (todayClosing || savingClosing) return
    setSavingClosing(true)
    setClosingError('')
    if (!closeRequestIdRef.current) closeRequestIdRef.current = createOrderCommandRequestId('close-register')
    try {
      await closeRegisterCommand({
        clientRequestId: closeRequestIdRef.current,
        storeId,
        businessDate,
        openingCash: openingCash === '' ? 0 : Number(openingCash),
        countedCash: countedCash === '' ? null : Number(countedCash),
        memo: memo.trim(),
      })
      await refreshData().catch(() => {})
    } catch (error) {
      setClosingError(formatOrderCommandError(error).message)
      logOrderCommandError({ operation: 'close_register', error, metadata: { storeId, businessDate } })
      if (error?.code === 'closing-already-exists' || error?.cause?.code === 'closing-already-exists') {
        await refreshData().catch(() => {})
      }
    } finally {
      setSavingClosing(false)
    }
  }

  async function handleVoid(reason) {
    if (!voidTarget || voiding) return
    setVoiding(true)
    setVoidError('')
    try {
      await voidCheckCommand({ storeId, checkId: voidTarget.id, reason })
      setVoidTarget(null)
      await refreshData().catch(() => {})
      setDetailSuccess('会計を取り消しました。')
    } catch (error) {
      setVoidError(formatOrderCommandError(error).message)
      logOrderCommandError({ operation: 'void_check', error, metadata: { storeId, checkId: voidTarget.id } })
    } finally {
      setVoiding(false)
    }
  }

  async function handleStartCorrection(items) {
    if (!selectedCheck) return
    // 税率が残っていない会計は、サーバーと同じく店の設定の税率を使う（Number(null) は 0 になるので先に見る）。
    const recordedTaxRate = selectedCheck.taxRate === null || selectedCheck.taxRate === undefined ? NaN : Number(selectedCheck.taxRate)
    let taxRate = recordedTaxRate
    if (!Number.isFinite(taxRate)) {
      const config = await loadStoreConfig(storeId).catch(() => normalizeStoreConfig({}))
      taxRate = config.taxRate
    }
    setCorrection({ check: selectedCheck, items, taxRate })
  }

  async function handleCorrectionDone(result) {
    setCorrection(null)
    await refreshData().catch(() => {})
    setSelectedCheckId(result?.checkId ?? null)
    setDetailError('')
    setDetailSuccess('打ち直しました。こちらが新しい会計です。')
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
          assigneeManager.resetMessages()
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
          <SalesTodayView
            businessDate={businessDate}
            checks={[...todayChecks, ...todayVoidedChecks]}
            closing={todayClosing}
            closingPanelProps={{
              cashSales: todaySummary.cashSales,
              countedCash,
              error: closingError,
              memo,
              openingCash,
              saving: savingClosing,
              onClose: handleClose,
              onCountedCashChange: setCountedCash,
              onMemoChange: setMemo,
              onOpeningCashChange: setOpeningCash,
            }}
            summary={todaySummary}
            onSelectCheck={handleSelectCheck}
          />
        </>
      ) : (
        <>
        <SalesHistoryView
          assigneeFilter={assigneeFilter}
          assignees={assignees}
          attributionSummary={attributionSummary}
          checks={visibleHistoryChecks}
          closings={periodClosings}
          endDate={endDate}
          hasMore={visibleCount < historyListChecks.length}
          monthKey={monthKey}
          periodMode={periodMode}
          startDate={startDate}
          summary={historySummary}
          summaryTitle={historySummaryTitle}
          totalCount={historyListChecks.length}
          onSelectClosingDate={handleClosingDrilldown}
          onAssigneeFilterChange={value => updateParams({ assignee: value === 'all' ? null : value })}
          onDateRangeChange={handleDateRangeChange}
          onLoadMore={() => setVisibleCount(count => count + PAGE_SIZE)}
          onMonthMove={handleMonthMove}
          onPeriodModeChange={handlePeriodModeChange}
          onSelectCheck={handleSelectCheck}
        />
        </>
      )}

      <SalesCheckDetailModal
        assignees={assignees}
        check={voidTarget || correction ? null : selectedCheck}
        correctionLockedMessage={correctionLockedMessage}
        error={detailError}
        saving={detailSaving}
        successMessage={detailSuccess}
        onClose={() => setSelectedCheckId(null)}
        onCorrect={handleStartCorrection}
        onSaveAttribution={handleSaveAttribution}
        onVoid={() => {
          setVoidError('')
          setVoidTarget(selectedCheck)
        }}
      />
      <CheckVoidSheet
        check={voidTarget}
        error={voidError}
        saving={voiding}
        onClose={() => setVoidTarget(null)}
        onVoid={handleVoid}
      />
      {correction && (
        <CheckCorrectionScreen
          activeStaff={activeStaff}
          check={correction.check}
          items={correction.items}
          storeId={storeId}
          taxRate={correction.taxRate}
          onCancel={() => setCorrection(null)}
          onDone={handleCorrectionDone}
        />
      )}
      <SalesAssigneeManagerModal
        {...assigneeManager.modalProps}
        assignees={assignees}
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
      />
    </div>
  )
}
