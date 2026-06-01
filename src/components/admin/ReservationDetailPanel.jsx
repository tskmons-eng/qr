import ReservationForm from './ReservationForm'
import ReservationList from './ReservationList'

export default function ReservationDetailPanel({
  selectedDateLabel,
  showForm,
  form,
  tables,
  reservations,
  saving,
  onToggleForm,
  onFormChange,
  onAddReservation,
  onStatusChange,
}) {
  return (
    <div className="reservation-detail">
      <div className="reservation-detail__header">
        <div>{selectedDateLabel}</div>
        <button type="button" onClick={onToggleForm}>
          {showForm ? '閉じる' : '+ 追加'}
        </button>
      </div>

      {showForm && (
        <ReservationForm
          form={form}
          tables={tables}
          saving={saving}
          onFormChange={onFormChange}
          onSubmit={onAddReservation}
        />
      )}

      <ReservationList
        reservations={reservations}
        tables={tables}
        onStatusChange={onStatusChange}
      />
    </div>
  )
}
