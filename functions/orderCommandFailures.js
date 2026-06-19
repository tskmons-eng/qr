const { FieldValue, getFirestore } = require('firebase-admin/firestore')
const { ORDER_COMMAND_VERSION } = require('./orderCommandShared')

const FAILURE_COLLECTION = 'orderCommandFailures'
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

function getErrorContext(error) {
  return error?.orderCommandContext && typeof error.orderCommandContext === 'object'
    ? error.orderCommandContext
    : {}
}

function extractRequestContext(data = {}) {
  const targetTableId = data.targetTable?.id ?? data.targetTableId ?? null
  return {
    storeId: data.storeId,
    tableId: data.tableId ?? data.sourceTableId,
    targetTableId,
    orderId: data.orderId,
    itemId: data.itemId,
    clientRequestId: data.clientRequestId,
  }
}

function buildOrderCommandFailurePayload({ context = {}, error, timestamp }) {
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

function buildOrderCommandFailureContext({ commandContext = {}, data = {}, error }) {
  return {
    ...commandContext,
    ...extractRequestContext(data),
    ...getErrorContext(error),
  }
}

function formatLogFailureCode(error) {
  return error?.code ?? error?.name ?? DEFAULT_ERROR_CODE
}

async function recordOrderCommandFailure(context, error) {
  let payload
  try {
    payload = buildOrderCommandFailurePayload({
      context,
      error,
      timestamp: FieldValue.serverTimestamp(),
    })
    await getFirestore().collection(FAILURE_COLLECTION).add(payload)
  } catch (logError) {
    console.warn('order command failure logging failed', {
      commandType: payload?.commandType ?? context?.commandType ?? DEFAULT_COMMAND_TYPE,
      errorCode: formatLogFailureCode(logError),
    })
  }
}

module.exports = {
  buildOrderCommandFailureContext,
  buildOrderCommandFailurePayload,
  recordOrderCommandFailure,
}
