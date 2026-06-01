import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaffBottomNav from '../../components/StaffBottomNav'
import StaffTableCard from '../../components/staff/StaffTableCard'
import StaffTableListEmpty from '../../components/staff/StaffTableListEmpty'
import { useStore } from '../../contexts/StoreContext'
import useNow from '../../hooks/useNow'
import { subscribeStaffPendingCounts, subscribeStaffTables } from '../../services/staffTableListService'

export default function TableListPage() {
  const { storeId } = useStore()
  const [tables, setTables] = useState([])
  const [pendingMap, setPendingMap] = useState({})
  const navigate = useNavigate()
  const now = useNow()

  useEffect(() => {
    if (!storeId) return
    return subscribeStaffTables(storeId, setTables)
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    return subscribeStaffPendingCounts(storeId, setPendingMap)
  }, [storeId])

  if (tables.length === 0) return <StaffTableListEmpty />

  return (
    <div className="staff-table-list">
      <div className="staff-table-list__grid">
        {tables.map(table => (
          <StaffTableCard
            key={table.id}
            table={table}
            pending={pendingMap[table.id] ?? { total: 0, drink: 0, food: 0 }}
            now={now}
            onClick={() => navigate(`table/${table.id}`)}
          />
        ))}
      </div>
      <StaffBottomNav current="seat" />
    </div>
  )
}
