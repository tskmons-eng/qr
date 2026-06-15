import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaffBottomNav from '../../components/StaffBottomNav'
import StaffTableCard from '../../components/staff/StaffTableCard'
import StaffTableListEmpty from '../../components/staff/StaffTableListEmpty'
import TodayReservationNoticeList from '../../components/staff/TodayReservationNoticeList'
import { useStore } from '../../contexts/StoreContext'
import useNow from '../../hooks/useNow'
import { getNextReservationForTable, getTokyoDateString, getUnassignedTodayReservations } from '../../lib/reservationDisplay'
import { getStaffTablePending } from '../../lib/staffTableList'
import { buildTableGroupTabs, filterTablesByGroup } from '../../lib/tableGroups'
import { tablesNeedPendingFallback } from '../../lib/tablePending'
import { subscribeTodayReservations } from '../../services/reservationService'
import { subscribeStaffPendingCounts, subscribeStaffTables } from '../../services/staffTableListService'
import { subscribeTableGroups } from '../../services/tableGroupService'

export default function TableListPage() {
  const { storeId } = useStore()
  const [tables, setTables] = useState([])
  const [groups, setGroups] = useState([])
  const [activeGroupId, setActiveGroupId] = useState('all')
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

  if (tables.length === 0) {
    return (
      <div className="staff-table-list">
        <TodayReservationNoticeList
          reservations={getUnassignedTodayReservations(todayReservations, today)}
          tables={tables}
        />
        <StaffTableListEmpty />
        <StaffBottomNav current="seat" />
      </div>
    )
  }

  const tabs = buildTableGroupTabs(groups)
  const visibleTables = filterTablesByGroup(tables, activeGroupId)

  return (
    <div className="staff-table-list">
      {tabs.length > 1 && (
        <div className="staff-table-list__tabs" role="tablist" aria-label="席グループ">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveGroupId(tab.id)}
              className={`staff-table-list__tab${activeGroupId === tab.id ? ' is-active' : ''}`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}
      <div className="staff-table-list__grid">
        <TodayReservationNoticeList
          reservations={getUnassignedTodayReservations(todayReservations, today)}
          tables={tables}
        />
        {visibleTables.map(table => (
          <StaffTableCard
            key={table.id}
            table={table}
            pending={getStaffTablePending(table, pendingMap)}
            reservation={getNextReservationForTable(todayReservations, table.id, today)}
            now={now}
            onClick={() => navigate(`table/${table.id}`)}
          />
        ))}
      </div>
      {visibleTables.length === 0 && (
        <p className="staff-table-list__empty-group">このグループの席はまだありません</p>
      )}
      <StaffBottomNav current="seat" />
    </div>
  )
}
