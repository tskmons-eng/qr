import { useEffect, useState } from 'react'
import { normalizeTableName } from '../lib/adminTable'
import { reorderById } from '../lib/sortOrder'
import { getTokyoDateString } from '../lib/reservationDisplay'
import { planTableSortOrders } from '../lib/tableOrder'
import {
  batchUpdateTableSortOrder,
  createAdminTables,
  deleteAdminTable,
  loadUpcomingReservationsForTable,
  reissueAdminTableQr,
  renameAdminTable,
  subscribeAdminTables,
} from '../services/adminTableService'

const SAVE_FAILED = '保存できませんでした。通信を確かめて、もう一度お試しください'

// 席の管理の状態と操作（2026-10-23 席設計）。操作は失敗したら文言を返し、成功したら null を返す（シートに出す）。
export default function useTableAdmin(storeId) {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!storeId) return undefined
    return subscribeAdminTables(storeId, nextTables => {
      setTables(nextTables)
      setLoading(false)
      setLoadError('')
    }, () => {
      setLoading(false)
      setLoadError('席を読み込めませんでした。通信を確かめてください')
    })
  }, [storeId])

  async function addTables(tableNames) {
    const names = tableNames.map(normalizeTableName).filter(Boolean)
    if (names.length === 0) return '席の名前を入れてください'
    try {
      await createAdminTables({ storeId, tableNames: names, ...planTableSortOrders(tables, names.length) })
      return null
    } catch {
      return SAVE_FAILED
    }
  }

  async function renameTable(table, name) {
    const nextName = normalizeTableName(name)
    if (!nextName) return '席の名前を入れてください'
    if (tables.some(item => item.id !== table.id && item.tableName === nextName)) return '同じ名前の席がもうあります'
    try {
      await renameAdminTable(table.id, nextName)
      return null
    } catch {
      return SAVE_FAILED
    }
  }

  // 並べ替えると、全部の席に並び順を付ける（それまで並び順が無かった店も、ここから決めた順になる）。
  async function reorderTables(dragId, targetId) {
    const result = reorderById(tables, dragId, targetId)
    if (!result) return null
    setTables(result.next)
    try {
      await batchUpdateTableSortOrder(result.updates)
      return null
    } catch {
      return SAVE_FAILED
    }
  }

  async function reissueQr(table) {
    try {
      await reissueAdminTableQr(table.id)
      return null
    } catch {
      return SAVE_FAILED
    }
  }

  // お客様がいる席は消さない（firestore.rules でも止める）。
  async function deleteTable(table) {
    if (table.status !== 'vacant' || table.currentOrderId) {
      return 'お客様がいる席は削除できません。会計を終えて空き席になってから消してください'
    }
    try {
      // 予約が入っている席を消すと、その予約がどの席にも出なくなる。先に予約の席を変えてもらう。
      const reservations = await loadUpcomingReservationsForTable({ storeId, tableId: table.id, today: getTokyoDateString() })
      if (reservations.length > 0) {
        return `この席には今日以降の予約が${reservations.length}件入っています。先に予約の席を変えてから消してください`
      }
      await deleteAdminTable(table.id)
      return null
    } catch {
      return '削除できませんでした。空き席か、通信を確かめて、もう一度お試しください'
    }
  }

  return { tables, loading, loadError, addTables, renameTable, reorderTables, reissueQr, deleteTable }
}
