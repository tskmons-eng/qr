import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '../lib/firebase'

const ORDER_COMMAND_RUNTIME = import.meta.env.VITE_ORDER_COMMAND_RUNTIME
const FUNCTIONS_REGION = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION
const IS_PRODUCTION_BUILD = import.meta.env.PROD
const ORDER_SUBMIT_PRIMARY_REGION = 'asia-northeast1'
const ORDER_SUBMIT_FALLBACK_REGION = 'us-central1'

const functionsInstances = new Map()
const REGIONAL_FALLBACK_CODES = new Set([
  'aborted',
  'cancelled',
  'deadline-exceeded',
  'internal',
  'not-found',
  'resource-exhausted',
  'unavailable',
  'unknown',
])

function getOrderCommandFunctions(region = FUNCTIONS_REGION) {
  const normalizedRegion = region || null
  const cacheKey = normalizedRegion ?? '__default__'
  if (!functionsInstances.has(cacheKey)) {
    functionsInstances.set(
      cacheKey,
      normalizedRegion ? getFunctions(app, normalizedRegion) : getFunctions(app),
    )
  }
  return functionsInstances.get(cacheKey)
}

function restoreCommandError(error) {
  const commandCode = error?.details?.code
  if (commandCode) error.code = commandCode
  return error
}

function normalizeCallableErrorCode(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^functions\//, '')
    .replaceAll('_', '-')
}

function shouldFallbackToExistingSubmitCallable(error) {
  const callableCode = normalizeCallableErrorCode(error?.code)
  if (!REGIONAL_FALLBACK_CODES.has(callableCode)) return false

  const commandCode = normalizeCallableErrorCode(error?.details?.code)
  return !commandCode || REGIONAL_FALLBACK_CODES.has(commandCode)
}

async function invokeOrderCommandFunction(functionName, payload, region) {
  const callable = httpsCallable(getOrderCommandFunctions(region), functionName)
  const result = await callable(payload)
  return result.data
}

export function shouldUseOrderCommandFunctions() {
  if (ORDER_COMMAND_RUNTIME === 'client') return false
  if (ORDER_COMMAND_RUNTIME === 'functions') return true
  return IS_PRODUCTION_BUILD
}

export async function callOrderCommandFunction(functionName, payload = {}) {
  try {
    return await invokeOrderCommandFunction(functionName, payload, FUNCTIONS_REGION)
  } catch (error) {
    throw restoreCommandError(error)
  }
}

export async function callRegionalOrderSubmitFunction(
  regionalFunctionName,
  fallbackFunctionName,
  payload = {},
) {
  try {
    return await invokeOrderCommandFunction(
      regionalFunctionName,
      payload,
      ORDER_SUBMIT_PRIMARY_REGION,
    )
  } catch (error) {
    if (!shouldFallbackToExistingSubmitCallable(error)) {
      throw restoreCommandError(error)
    }
  }

  try {
    return await invokeOrderCommandFunction(
      fallbackFunctionName,
      payload,
      ORDER_SUBMIT_FALLBACK_REGION,
    )
  } catch (error) {
    throw restoreCommandError(error)
  }
}
