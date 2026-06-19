import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  canEnterStaffStore,
  normalizeStaffStoreCode,
  saveStaffStoreCodePreference,
  SAVED_STAFF_STORE_CODE_KEY,
} from '../src/lib/staffEntry.js'

assert.equal(normalizeStaffStoreCode(' ab-12_cd 345 '), 'AB12CD')
assert.equal(canEnterStaffStore('ABC12'), false)
assert.equal(canEnterStaffStore('ABC123'), true)

const storage = new Map()
const storageAdapter = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
}
saveStaffStoreCodePreference({ code: 'ABC123', remember: true, storage: storageAdapter })
assert.equal(storage.get(SAVED_STAFF_STORE_CODE_KEY), 'ABC123')
saveStaffStoreCodePreference({ code: 'ABC123', remember: false, storage: storageAdapter })
assert.equal(storage.has(SAVED_STAFF_STORE_CODE_KEY), false)

const staffEntryService = readFileSync(new URL('../src/services/staffEntryService.js', import.meta.url), 'utf8')
const staffLoginScreen = readFileSync(new URL('../src/components/staff/StaffLoginScreen.jsx', import.meta.url), 'utf8')
const staffLayout = readFileSync(new URL('../src/pages/staff/StaffLayout.jsx', import.meta.url), 'utf8')
const loginPage = readFileSync(new URL('../src/pages/staff/LoginPage.jsx', import.meta.url), 'utf8')
const privateRoute = readFileSync(new URL('../src/components/PrivateRoute.jsx', import.meta.url), 'utf8')
const staffLoginService = readFileSync(new URL('../src/services/staffLoginService.js', import.meta.url), 'utf8')
const storeContext = readFileSync(new URL('../src/contexts/StoreContext.jsx', import.meta.url), 'utf8')

assert.match(staffEntryService, /forceAnonymous = false/)
assert.match(staffEntryService, /signOut\(auth\)/)
assert.match(staffLoginScreen, /handleStoreCodeSubmit/)
assert.match(staffLoginScreen, /enterStaffStoreByCode\(normalized, \{ forceAnonymous: forceAnonymousStoreEntry \}\)/)
assert.match(staffLoginScreen, /className="staff-login__store-code-panel"/)
assert.match(staffLoginScreen, /clearStaffAutoLoginPreference\(result\.storeId\)/)
assert.match(staffLayout, /forceAnonymousStoreEntry=\{Boolean\(user && !user\.isAnonymous\)\}/)
assert.match(staffLayout, /STAFF_ADMIN_LOGIN_PATH/)
assert.match(staffLayout, /encodeURIComponent\('\/admin\/staff'\)/)
assert.match(loginPage, /getSafeLoginRedirect/)
assert.match(loginPage, /const DEFAULT_LOGIN_REDIRECT = '\/admin'/)
assert.match(loginPage, /new URLSearchParams\(search\)\.get\('next'\)/)
assert.match(loginPage, /next === '\/staff'/)
assert.match(loginPage, /next\.startsWith\('\/staff\/'\)/)
assert.match(loginPage, /LOGIN_REDIRECT_STORAGE_KEY/)
assert.match(loginPage, /rememberLoginRedirect\(loginRedirect\)/)
assert.match(loginPage, /clearLoginRedirect\(\)/)
assert.match(loginPage, /getPersistentLoginRedirectStorage/)
assert.match(loginPage, /localStorage/)
assert.match(loginPage, /savedPersistentRedirect/)
assert.match(loginPage, /removeItem\(LOGIN_REDIRECT_STORAGE_KEY\)/)
assert.match(loginPage, /consumeStaffGoogleRedirectResult\(\)[\s\S]*\.then\(result =>/)
assert.match(loginPage, /navigate\(loginRedirect, \{ replace: true \}\)/)
assert.match(loginPage, /const result = await signInStaffWithGoogle\(\)/)
assert.match(privateRoute, /useLocation/)
assert.match(privateRoute, /loginPath = `\/login\?next=\$\{encodeURIComponent\(next\)\}`/)
assert.match(privateRoute, /!user \|\| user\.isAnonymous/)
assert.match(staffLoginService, /auth\.currentUser\?\.isAnonymous/)
assert.match(staffLoginService, /await signOut\(auth\)/)
assert.match(staffLoginService, /signInWithPopup/)
assert.match(staffLoginService, /shouldFallbackToRedirect/)
assert.match(staffLoginService, /signInWithRedirect/)
assert.match(storeContext, /doc\(db, 'staffSessions', user\.uid\)/)
assert.match(storeContext, /sessionStoreId === deviceStoreId/)
assert.match(storeContext, /localStorage\.removeItem\('deviceStoreId'\)/)
assert.match(storeContext, /localStorage\.removeItem\('activeStaff'\)/)

console.log('staff entry checks passed')
