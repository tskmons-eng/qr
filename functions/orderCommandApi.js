const { onCall, HttpsError } = require('firebase-functions/v2/https')
const {
  buildOrderCommandFailureContext,
  recordOrderCommandFailure,
} = require('./orderCommandFailures')

const ORDER_COMMAND_REGION = 'us-central1'

const COMMAND_HTTP_ERROR_CODES = new Map([
  ['invalid-argument', 'invalid-argument'],
  ['invalid-quantity', 'invalid-argument'],
  ['empty-order', 'invalid-argument'],
  ['unauthenticated', 'unauthenticated'],
  ['permission-denied', 'permission-denied'],
  ['reservation-not-found', 'not-found'],
  ['reservation-store-mismatch', 'failed-precondition'],
  ['reservation-closed', 'failed-precondition'],
  ['table-not-found', 'not-found'],
  ['source-table-not-found', 'not-found'],
  ['target-table-not-found', 'not-found'],
  ['order-not-found', 'not-found'],
  ['item-not-found', 'not-found'],
  ['product-not-found', 'not-found'],
  ['checkout-already-exists', 'already-exists'],
  ['checkout-items-stale', 'failed-precondition'],
  ['order-already-checked-out', 'failed-precondition'],
  ['order-not-open', 'failed-precondition'],
  ['table-not-vacant', 'failed-precondition'],
  ['target-table-not-vacant', 'failed-precondition'],
  ['table-order-mismatch', 'failed-precondition'],
  ['source-order-mismatch', 'failed-precondition'],
  ['table-scope-mismatch', 'failed-precondition'],
  ['order-scope-mismatch', 'failed-precondition'],
  ['item-table-mismatch', 'failed-precondition'],
  ['item-scope-mismatch', 'failed-precondition'],
  ['product-scope-mismatch', 'failed-precondition'],
  ['category-scope-mismatch', 'failed-precondition'],
])

function isFirestoreTransactionContentionError(error) {
  const code = String(error?.code ?? '').toLowerCase()
  const message = [
    error?.message,
    error?.details,
    error?.stack,
  ].filter(Boolean).join('\n')

  return (
    code === '3' ||
    code === '10' ||
    code.includes('aborted') ||
    code.includes('deadline') ||
    code.includes('invalid')
  ) && /transaction (lock timeout|is invalid|was aborted|is invalid or closed|too much contention)/i.test(message)
}

function normalizeCommandError(error, commandContext = {}) {
  if (commandContext.commandType === 'complete_checkout' && isFirestoreTransactionContentionError(error)) {
    return {
      code: 'checkout-items-stale',
      message: 'Checkout items changed. Reload checkout before closing.',
    }
  }
  return error
}

function toHttpsError(error, commandContext = {}) {
  if (error instanceof HttpsError) return error
  const normalizedError = normalizeCommandError(error, commandContext)
  const commandCode = typeof normalizedError?.code === 'string' ? normalizedError.code : 'internal'
  const httpsCode = COMMAND_HTTP_ERROR_CODES.get(commandCode) || 'internal'
  return new HttpsError(
    httpsCode,
    normalizedError?.message || 'Order command failed.',
    { code: commandCode }
  )
}

function createOrderCommandCallable(handler, commandContext = {}) {
  return onCall({ cors: true, region: ORDER_COMMAND_REGION }, async request => {
    try {
      return await handler(request.data ?? {}, request)
    } catch (error) {
      await recordOrderCommandFailure(
        buildOrderCommandFailureContext({
          commandContext,
          data: request.data ?? {},
          error,
        }),
        error
      )
      throw toHttpsError(error, commandContext)
    }
  })
}

module.exports = {
  createOrderCommandCallable,
  ORDER_COMMAND_REGION,
}
