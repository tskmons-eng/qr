import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const storeContext = readFileSync(new URL('../src/contexts/StoreContext.jsx', import.meta.url), 'utf8')
const authSession = readFileSync(new URL('../src/services/authSessionService.js', import.meta.url), 'utf8')
const ownerDashboardService = readFileSync(new URL('../src/services/ownerDashboardService.js', import.meta.url), 'utf8')
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')

assert.match(storeContext, /storeAdminEmails/)
assert.match(authSession, /storeAdminEmails/)
assert.match(ownerDashboardService, /export async function updateStoreAdminEmail/)
assert.match(ownerDashboardService, /writeBatch/)
assert.match(rules, /function isStoreAdminEmail\(storeId\)/)
assert.match(rules, /match \/storeAdminEmails\/\{email\}/)
assert.match(rules, /data\.get\('ownerEmail', request\.auth\.token\.email\) == request\.auth\.token\.email/)
assert.match(rules, /allow write: if isSuper\(\);/)
assert.match(rules, /allow update, delete: if canManageStore\(storeId\);/)

console.log('store admin assignment checks passed')
