import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const storeContext = readFileSync(new URL('../src/contexts/StoreContext.jsx', import.meta.url), 'utf8')
const authSession = readFileSync(new URL('../src/services/authSessionService.js', import.meta.url), 'utf8')
const ownerDashboardService = readFileSync(new URL('../src/services/ownerDashboardService.js', import.meta.url), 'utf8')
const ownerStoreDashboard = readFileSync(new URL('../src/components/owner/OwnerStoreDashboard.jsx', import.meta.url), 'utf8')
const adminLayout = readFileSync(new URL('../src/pages/admin/AdminLayout.jsx', import.meta.url), 'utf8')
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
const updateStoreAdminEmailSource = ownerDashboardService.slice(
  ownerDashboardService.indexOf('export async function updateStoreAdminEmail')
)

assert.match(storeContext, /storeAdminEmails/)
assert.match(storeContext, /doc\(db, 'storeAdminEmails', normalizedEmail\)/)
assert.match(storeContext, /setStoreId\(assignedStoreId\)/)
assert.match(storeContext, /OWNER_ACTIVE_STORE_ID_KEY = 'ownerActiveStoreId'/)
assert.match(storeContext, /isSuperAdminEmail\(normalizedEmail\)/)
assert.match(storeContext, /getDoc\(doc\(db, 'stores', selectedStoreId\)\)/)
assert.match(storeContext, /setStoreId\(selectedStoreId\)/)
assert.match(storeContext, /function activateOwnerStore\(id\)/)
assert.match(storeContext, /return false/)
assert.match(storeContext, /localStorage\.setItem\(OWNER_ACTIVE_STORE_ID_KEY, id\)/)
assert.match(storeContext, /function clearOwnerStore\(\)/)
assert.match(authSession, /storeAdminEmails/)
assert.match(ownerDashboardService, /export async function updateStoreAdminEmail/)
assert.match(ownerDashboardService, /writeBatch/)
assert.match(ownerDashboardService, /assignmentSnap\.exists\(\) && assignmentSnap\.data\(\)\.storeId !== storeId/)
assert.match(
  ownerDashboardService,
  /const batch = writeBatch\(db\)[\s\S]*batch\.delete\(doc\(db, 'storeAdminEmails', normalizedCurrentEmail\)\)[\s\S]*batch\.set\(assignmentRef,[\s\S]*batch\.update\(doc\(db, 'stores', storeId\),[\s\S]*ownerEmail: normalizedEmail[\s\S]*await batch\.commit\(\)/
)
assert.doesNotMatch(
  updateStoreAdminEmailSource,
  /collection\(db, '(orders|orderItems|checks|tables|products|categories|staffMembers)'/
)
assert.doesNotMatch(
  updateStoreAdminEmailSource,
  /doc\(db, 'stores', (normalizedEmail|nextEmail)\)/
)
assert.match(ownerStoreDashboard, /<th>名義メール<\/th>/)
assert.match(ownerStoreDashboard, /店舗ID・履歴はそのまま/)
assert.match(ownerStoreDashboard, /<th>詳細<\/th>/)
assert.match(adminLayout, /clearOwnerStore/)
assert.match(adminLayout, /loadStoreIdentity\(storeId\)/)
assert.match(rules, /function isStoreAdminEmail\(storeId\)/)
assert.match(rules, /match \/storeAdminEmails\/\{email\}/)
assert.match(rules, /data\.get\('ownerEmail', request\.auth\.token\.email\) == request\.auth\.token\.email/)
assert.match(rules, /allow write: if isSuper\(\);/)
assert.match(rules, /allow update, delete: if canManageStore\(storeId\);/)

console.log('store admin assignment checks passed')
