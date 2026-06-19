import { useEffect, useRef, useState } from 'react'
import { loadSoundPrefs, playSound } from '../../lib/sounds'
import {
  dismissReservationWait,
  guideReservationToTable,
  subscribePendingReservationWaits,
  subscribeReservationTables,
} from '../../services/reservationService'
import StaffReservationWaitBanner from './StaffReservationWaitBanner'

export default function StaffReservationWaitController({
  activeStaff,
  notificationsEnabled,
  storeId,
  onOpenTable,
}) {
  const [reservationWaits, setReservationWaits] = useState([])
  const [reservationTables, setReservationTables] = useState([])
  const prevReservationWaitIdsRef = useRef(null)

  useEffect(() => {
    if (!storeId || !activeStaff) return undefined
    return subscribePendingReservationWaits(storeId, data => {
      const previousIds = prevReservationWaitIdsRef.current
      const newWaits = previousIds === null ? [] : data.filter(reservation => !previousIds.has(reservation.id))
      if (newWaits.length > 0 && notificationsEnabled) {
        const { soundId, volume } = loadSoundPrefs()
        playSound(soundId, volume)
      }
      prevReservationWaitIdsRef.current = new Set(data.map(reservation => reservation.id))
      setReservationWaits(data)
    })
  }, [notificationsEnabled, storeId, activeStaff?.id])

  useEffect(() => {
    if (!storeId || reservationWaits.length === 0) {
      setReservationTables([])
      return undefined
    }
    return subscribeReservationTables(storeId, setReservationTables)
  }, [storeId, reservationWaits.length])

  async function handleDismissReservationWait(reservation) {
    if (!confirm(`${reservation.name ?? '予約'}様の予約待ち通知を消しますか？`)) return
    await dismissReservationWait({ reservationId: reservation.id, activeStaff })
  }

  async function handleSeatReservation(reservation, targetTableId) {
    const targetTable = reservationTables.find(table => table.id === targetTableId)
    if (!targetTable) return
    if (targetTable.status !== 'vacant') {
      const ok = confirm(`${targetTable.tableName}は使用中です。\nこの席と現在の注文人数を予約人数（${reservation.guestCount}名）に上書きしますか？`)
      if (!ok) return
    }

    const result = await guideReservationToTable({
      reservationId: reservation.id,
      targetTableId,
      storeId: reservation.storeId,
      activeStaff,
    })
    if (!result.ok) {
      alert('予約の案内に失敗しました。席と予約の状態を確認してください。')
      return
    }
    onOpenTable(targetTableId)
  }

  return (
    <StaffReservationWaitBanner
      reservations={reservationWaits}
      tables={reservationTables}
      onDismiss={handleDismissReservationWait}
      onOpenTable={onOpenTable}
      onSeat={handleSeatReservation}
    />
  )
}
