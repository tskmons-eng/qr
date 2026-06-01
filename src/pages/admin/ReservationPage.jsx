import { useCallback, useEffect, useState } from 'react'
import ReservationCalendar from '../../components/admin/ReservationCalendar'
import ReservationDetailPanel from '../../components/admin/ReservationDetailPanel'
import { useStore } from '../../contexts/StoreContext'
import {
  emptyReservationForm,
  formatReservationDateLabel,
  getActiveReservationsForDate,
  getDaysInMonth,
  getFirstDayOfWeek,
  groupReservationsByDate,
  todayStr,
} from '../../lib/reservationCalendar'
import {
  createReservationRecord,
  loadReservationAdminData,
  updateReservationStatus,
} from '../../services/reservationAdminService'

export default function ReservationPage() {
  const { storeId } = useStore()
  const [reservations, setReservations] = useState([])
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyReservationForm(todayStr()))
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!storeId) return
    const data = await loadReservationAdminData(storeId)
    setReservations(data.reservations)
    setTables(data.tables)
    setLoading(false)
  }, [storeId])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear(year => year - 1)
      setViewMonth(11)
      return
    }
    setViewMonth(month => month - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear(year => year + 1)
      setViewMonth(0)
      return
    }
    setViewMonth(month => month + 1)
  }

  function handleDayClick(dateStr) {
    setSelectedDate(dateStr)
    setShowForm(false)
    setForm(emptyReservationForm(dateStr))
  }

  function toggleForm() {
    setShowForm(value => !value)
    setForm(emptyReservationForm(selectedDate))
  }

  async function handleAdd() {
    if (!form.name.trim() || !form.date || !form.time) return
    setSaving(true)
    try {
      await createReservationRecord({ storeId, form })
      setShowForm(false)
      setForm(emptyReservationForm(selectedDate))
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleStatus(id, status) {
    await updateReservationStatus(id, status)
    setReservations(prev => prev.map(reservation => (
      reservation.id === id ? { ...reservation, status } : reservation
    )))
  }

  const reservationsByDate = groupReservationsByDate(reservations)
  const selectedReservations = getActiveReservationsForDate(reservationsByDate, selectedDate)

  if (loading) return <p className="reservation-list__empty">読み込み中...</p>

  return (
    <div>
      <h2 className="reservation-page__title">予約管理</h2>
      <div className="reservation-page__layout">
        <ReservationCalendar
          viewYear={viewYear}
          viewMonth={viewMonth}
          daysInMonth={getDaysInMonth(viewYear, viewMonth)}
          firstDow={getFirstDayOfWeek(viewYear, viewMonth)}
          reservationsByDate={reservationsByDate}
          selectedDate={selectedDate}
          todayISO={todayStr()}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onSelectDate={handleDayClick}
        />
        <ReservationDetailPanel
          selectedDateLabel={formatReservationDateLabel(selectedDate)}
          showForm={showForm}
          form={form}
          tables={tables}
          reservations={selectedReservations}
          saving={saving}
          onToggleForm={toggleForm}
          onFormChange={setForm}
          onAddReservation={handleAdd}
          onStatusChange={handleStatus}
        />
      </div>
    </div>
  )
}
