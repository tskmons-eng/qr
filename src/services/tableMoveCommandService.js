import { withOrderCommandFailureLog } from './orderCommandFailureService'
import { callOrderCommandFunction } from './orderFunctionCommandService'

// 席移動は必ずサーバー（Functions）を通す。ブラウザから直接書く予備は 2026-10-22 に廃止（整理 第4章）。
// 操作したスタッフはサーバーが端末の記録から決めるので、画面からは送らない。
export function moveTableOrderCommand({ sourceTable, sourceTableId, targetTable }) {
  return withOrderCommandFailureLog({
    commandType: 'move_table_order',
    actorType: 'staff',
    storeId: sourceTable?.storeId ?? targetTable?.storeId,
    tableId: sourceTableId,
    targetTableId: targetTable?.id,
    orderId: sourceTable?.currentOrderId,
  }, () => callOrderCommandFunction('moveTableOrderCommand', { sourceTableId, targetTable }))
}
