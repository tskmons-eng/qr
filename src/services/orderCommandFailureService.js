import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { buildOrderCommandFailurePayload } from '../lib/orderCommandFailures'
import { db } from '../lib/firebase'

const FAILURE_COLLECTION = 'orderCommandFailures'

function getErrorContext(error) {
  return error?.orderCommandContext && typeof error.orderCommandContext === 'object'
    ? error.orderCommandContext
    : {}
}

function formatLogFailureCode(error) {
  return error?.code ?? error?.name ?? 'unknown'
}

export async function recordOrderCommandFailure(context, error) {
  let payload
  try {
    payload = buildOrderCommandFailurePayload({
      context,
      error,
      timestamp: serverTimestamp(),
    })
    await addDoc(collection(db, FAILURE_COLLECTION), payload)
  } catch (logError) {
    console.warn('order command failure logging failed', {
      commandType: payload?.commandType ?? context?.commandType ?? 'unknown_order_command',
      errorCode: formatLogFailureCode(logError),
    })
  }
}

export async function withOrderCommandFailureLog(context, operation) {
  try {
    return await operation()
  } catch (error) {
    void recordOrderCommandFailure({ ...context, ...getErrorContext(error) }, error)
    throw error
  }
}
