import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '../lib/firebase'

const ORDER_COMMAND_RUNTIME = import.meta.env.VITE_ORDER_COMMAND_RUNTIME
const FUNCTIONS_REGION = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION
const IS_PRODUCTION_BUILD = import.meta.env.PROD

let functionsInstance = null

function getOrderCommandFunctions() {
  if (!functionsInstance) {
    functionsInstance = FUNCTIONS_REGION
      ? getFunctions(app, FUNCTIONS_REGION)
      : getFunctions(app)
  }
  return functionsInstance
}

function restoreCommandError(error) {
  const commandCode = error?.details?.code
  if (commandCode) error.code = commandCode
  return error
}

export function shouldUseOrderCommandFunctions() {
  if (ORDER_COMMAND_RUNTIME === 'client') return false
  if (ORDER_COMMAND_RUNTIME === 'functions') return true
  return IS_PRODUCTION_BUILD
}

export async function callOrderCommandFunction(functionName, payload = {}) {
  const callable = httpsCallable(getOrderCommandFunctions(), functionName)
  try {
    const result = await callable(payload)
    return result.data
  } catch (error) {
    throw restoreCommandError(error)
  }
}
