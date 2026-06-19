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

function toHttpsError(error) {
  if (error instanceof HttpsError) return error
  const commandCode = error?.code || 'internal'
  const httpsCode = COMMAND_HTTP_ERROR_CODES.get(commandCode) || 'internal'
  return new HttpsError(
    httpsCode,
    error?.message || 'Order command failed.',
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
      throw toHttpsError(error)
    }
  })
}

module.exports = {
  createOrderCommandCallable,
  ORDER_COMMAND_REGION,
}
