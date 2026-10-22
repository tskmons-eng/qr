import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaffBottomNav from '../../components/StaffBottomNav'
import StaffTableCard, { StaffTableNeedRow, StaffVacantTableCell } from '../../components/staff/StaffTableCard'
import StaffTableListEmpty from '../../components/staff/StaffTableListEmpty'
import TodayReservationNoticeList from '../../components/staff/TodayReservationNoticeList'
import { useStore } from '../../contexts/StoreContext'
import useNow from '../../hooks/useNow'
import { getNextReservationForTable, getTokyoDateString, getUnassignedTodayReservations } from '../../lib/reservationDisplay'
import { STAFF_TABLE_FILTERS, buildStaffTableBoard } from '../../lib/staffTableList'
import { buildTableGroupTabs, filterTablesByGroup } from '../../lib/tableGroups'
import { tablesNeedPendingFallback } from '../../lib/tablePending'
import { subscribeTodayReservations } from '../../services/reservationService'
import { subscribeStaffPendingCounts, subscribeStaffTables } from '../../services/staffTableListService'
import { subscribeTableGroups } from '../../services/tableGroupService'

// 席一覧（2026-10-22 作り直し）：上＝対応が要る席、中＝利用中、下＝空席。
// 呼び出しは StaffLayout が購読しているものを受け取る（購読を増やさない）。席一覧では上の帯を出さず、行の「対応」で済ませる。
export default function TableListPage({ calls = [], onRespondCalls }) {
  const { storeId } = useStore()
  const [tables, setTables] = useState([])
  const [groups, setGroups] = useState([])
  const [activeGroupId, setActiveGroupId] = useState('all')
  const [activeFilter, setActiveFilter] = useState('all')
  const [pendingMap, setPendingMap] = useState({})
  const [todayReservations, setTodayReservations] = useState([])
  const navigate = useNavigate()
  const now = useNow()
  const today = getTokyoDateString()
  const usePendingFallback = tablesNeedPendingFallback(tables)

  useEffect(() => {
    if (!storeId) return
    return subscribeStaffTables(storeId, setTables)
  }, [storeId])

  useEffect(() => {
    if (!storeId || !usePendingFallback) {
      setPendingMap({})
      return undefined
    }
    return subscribeStaffPendingCounts(storeId, setPendingMap)
  }, [storeId, usePendingFallback])

  useEffect(() => {
    if (!storeId) return
    return subscribeTableGroups(storeId, setGroups)
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    return subscribeTodayReservations(storeId, today, setTodayReservations)
  }, [storeId, today])

  const unassignedReservations = getUnassignedTodayReservations(todayReservations, today)

  if (tables.length === 0) {
    return (
      <div className="staff-table-list">
        <TodayReservationNoticeList reservations={unassignedReservations} tables={tables} />
        <StaffTableListEmpty />
        <StaffBottomNav current="seat" />
      </div>
    )
  }

  const tabs = buildTableGroupTabs(groups)
  const board = buildStaffTableBoard({ tables: filterTablesByGroup(tables, activeGroupId), pendingMap, calls })
  const show = key => activeFilter === 'all' || activeFilter === key
  const openTable = table => navigate(`table/${table.id}`)
  const reservationFor = table => getNextReservationForTable(todayReservations, table.id, today)

  return (
    <div className="staff-table-list">
      {tabs.length > 1 && (
        <div className="staff-table-list__chips" role="tablist" aria-label="席グループ">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveGroupId(tab.id)}
              className={`staff-table-list__chip${activeGroupId === tab.id ? ' is-active' : ''}`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}
      <div className="staff-table-list__chips" role="tablist" aria-label="席の状態">
        {STAFF_TABLE_FILTERS.map(filter => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setActiveFilter(filter.key)}
            className={`staff-table-list__chip${activeFilter === filter.key ? ' is-active' : ''}`}
          >
            {filter.label}<b>{board.counts[filter.key]}</b>
          </button>
        ))}
      </div>

      <TodayReservationNoticeList reservations={unassignedReservations} tables={tables} />

      {show('needs') && board.needs.length > 0 && (
        <section className="staff-table-list__section" aria-label="対応が要る席">
          <h2 className="staff-table-list__heading">対応が要る席<span>古い順</span></h2>
          {board.needs.map(need => (
            <StaffTableNeedRow
              key={need.table.id}
              need={need}
              now={now}
              onClick={() => openTable(need.table)}
              onRespond={onRespondCalls}
            />
          ))}
        </section>
      )}

      {show('occupied') && board.occupied.length > 0 && (
        <section className="staff-table-list__section" aria-label="利用中">
          <h2 className="staff-table-list__heading">利用中 {board.occupied.length}</h2>
          <div className="staff-table-list__grid">
            {board.occupied.map(({ table, pending }) => (
              <StaffTableCard
                key={table.id}
                table={table}
                pending={pending}
                reservation={reservationFor(table)}
                now={now}
                onClick={() => openTable(table)}
              />
            ))}
          </div>
        </section>
      )}

      {show('vacant') && board.vacant.length > 0 && (
        <section className="staff-table-list__section" aria-label="空席">
          <h2 className="staff-table-list__heading">空席 {board.vacant.length}（押すと着席）</h2>
          <div className="staff-table-list__vacant">
            {board.vacant.map(({ table }) => (
              <StaffVacantTableCell
                key={table.id}
                table={table}
                reservation={reservationFor(table)}
                onClick={() => openTable(table)}
              />
            ))}
          </div>
        </section>
      )}

      {board.counts[activeFilter] === 0 && (
        <p className="staff-table-list__empty-group">
          {activeFilter === 'needs' ? '対応が要る席はありません' : 'この条件の席はありません'}
        </p>
      )}
      <StaffBottomNav current="seat" />
    </div>
  )
}
