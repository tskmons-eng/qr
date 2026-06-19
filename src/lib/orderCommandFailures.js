import { ORDER_COMMAND_VERSION } from './orderCommands'

const DEFAULT_COMMAND_TYPE = 'unknown_order_command'
const DEFAULT_ACTOR_TYPE = 'unknown'
const DEFAULT_ERROR_CODE = 'unknown'
const DEFAULT_ERROR_NAME = 'Error'
const DEFAULT_ERROR_MESSAGE = 'Unknown order command failure'

function normalizeText(value, maxLength) {
  if (value === undefined || value === null) return null
  const normalized = String(value).replace(/\s+/g, ' ').trim().slice(0, maxLength)
  return normalized || null
}

export function buildOrderCommandFailurePayload({ context = {}, error, timestamp }) {
  const errorCode = normalizeText(error?.code, 120)
    ?? normalizeText(error?.name, 120)
    ?? DEFAULT_ERROR_CODE

  return {
    commandType: normalizeText(context.commandType, 120) ?? DEFAULT_COMMAND_TYPE,
    actorType: normalizeText(context.actorType, 48) ?? DEFAULT_ACTOR_TYPE,
    storeId: normalizeText(context.storeId, 128),
    tableId: normalizeText(context.tableId, 128),
    targetTableId: normalizeText(context.targetTableId, 128),
    orderId: normalizeText(context.orderId, 128),
    itemId: normalizeText(context.itemId, 128),
    clientRequestId: normalizeText(context.clientRequestId, 160),
    errorCode,
    errorName: normalizeText(error?.name, 120) ?? DEFAULT_ERROR_NAME,
    errorMessage: normalizeText(error?.message, 500) ?? DEFAULT_ERROR_MESSAGE,
    orderCommandVersion: ORDER_COMMAND_VERSION,
    createdAt: timestamp,
  }
}
