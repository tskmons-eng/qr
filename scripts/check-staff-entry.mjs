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
// 2026-10-22 整理 第3章：店舗コードでの入室は共通の useStoreCodeEntry に一本化。必ず匿名のスタッフ端末として入り直す。
const storeCodeEntry = readFileSync(new URL('../src/hooks/useStoreCodeEntry.js', import.meta.url), 'utf8')
const staffEntryPage = readFileSync(new URL('../src/pages/staff/StaffEntryPage.jsx', import.meta.url), 'utf8')
const authenticatedApp = readFileSync(new URL('../src/AuthenticatedApp.jsx', import.meta.url), 'utf8')
assert.match(storeCodeEntry, /enterStaffStoreByCode\(normalized, \{ forceAnonymous: true \}\)/)
assert.match(storeCodeEntry, /clearStaffAutoLoginPreference\(result\.storeId\)/)
assert.match(staffEntryPage, /useStoreCodeEntry\(\{ autoEnterSaved: true \}\)/)
assert.match(staffLoginScreen, /useStoreCodeEntry\(\{ currentStoreId: storeId \}\)/)
assert.doesNotMatch(staffLoginScreen, /enterStaffStoreByCode/, 'store code entry should go through useStoreCodeEntry only')
// スタッフ0人の店の「管理者として入る」（パス無しで店長権限）は廃止。
assert.doesNotMatch(staffLoginScreen, /管理者として入る|id: 'admin'/)
// 4桁パスの後に入れなかったときは、必ず画面に理由を出す（K10 では何も出ずに止まっていた）。
assert.match(staffLoginScreen, /await onLogin\(buildStaffLoginPayload\(selected\)\)/)
assert.match(staffLoginScreen, /入れませんでした/)
// Google でログインした店長・オーナーは、許可を確かめたうえでスタッフを選ばずに「管理者」として入る。
assert.match(staffLayout, /buildStoreManagerStaff\(user\)/)
assert.match(staffLayout, /const activeStaff = storeManagerStaff \?\? storedStaff/)
assert.match(authenticatedApp, /function StaffRoute\(\)[\s\S]*?<ApprovalGate>[\s\S]*?<StaffLayout \/>/)
assert.match(authenticatedApp, /<Route path="\/admin\/\*" element=\{<AdminRedirect \/>\} \/>/)
assert.match(staffLayout, /STAFF_ADMIN_LOGIN_PATH/)
assert.match(staffLayout, /encodeURIComponent\('\/staff\/staff-admin'\)/)
assert.match(loginPage, /getSafeLoginRedirect/)
assert.match(loginPage, /const DEFAULT_LOGIN_REDIRECT = '\/staff'/)
assert.match(loginPage, /new URLSearchParams\(search\)\.get\('next'\)/)
assert.match(loginPage, /next\.startsWith\('\/\/'\)/)
assert.match(loginPage, /LOGIN_REDIRECT_STORAGE_KEY/)
assert.match(loginPage, /rememberLoginRedirect\(loginRedirect\)/)
assert.match(loginPage, /clearLoginRedirect\(\)/)
assert.match(loginPage, /getPersistentLoginRedirectStorage/)
assert.match(loginPage, /localStorage/)
assert.match(loginPage, /savedPersistentRedirect/)
assert.match(loginPage, /removeItem\(LOGIN_REDIRECT_STORAGE_KEY\)/)
assert.match(loginPage, /function getGoogleLoginErrorMessage\(error\)/)
assert.match(loginPage, /auth\/unauthorized-domain/)
assert.match(loginPage, /auth\/operation-not-allowed/)
assert.match(loginPage, /consumeStaffGoogleRedirectResult\(\)[\s\S]*\.then\(result =>/)
assert.match(loginPage, /navigate\(loginRedirect, \{ replace: true \}\)/)
assert.match(loginPage, /const \[googleLoading, setGoogleLoading\] = useState\(false\)/)
assert.match(loginPage, /setGoogleStatus\(GOOGLE_LOGIN_START_MESSAGE\)/)
assert.match(loginPage, /const result = await signInStaffWithGoogle\(\)/)
assert.match(loginPage, /setGoogleStatus\(GOOGLE_LOGIN_REDIRECT_MESSAGE\)/)
assert.match(loginPage, /<StaffGoogleLoginButton disabled=\{googleLoading\} loading=\{googleLoading\} onClick=\{handleGoogle\} \/>/)
assert.doesNotMatch(loginPage, /<StaffGoogleLoginButton disabled=\{loading\}/)
assert.doesNotMatch(
  loginPage.slice(loginPage.indexOf('async function handleGoogle')),
  /setLoading\(true\)[\s\S]*signInStaffWithGoogle/
)
assert.match(privateRoute, /useLocation/)
assert.match(privateRoute, /loginPath = `\/login\?next=\$\{encodeURIComponent\(next\)\}`/)
assert.match(privateRoute, /!user \|\| user\.isAnonymous/)
assert.match(staffLoginService, /auth\.currentUser\?\.isAnonymous/)
assert.match(staffLoginService, /await signOut\(auth\)/)
assert.match(staffLoginService, /signInWithPopup/)
assert.match(staffLoginService, /shouldFallbackToRedirect/)
assert.match(staffLoginService, /auth\/popup-closed-by-user/)
assert.match(staffLoginService, /signInWithRedirect/)
assert.match(storeContext, /doc\(db, 'staffSessions', user\.uid\)/)
assert.match(storeContext, /sessionStoreId === deviceStoreId/)
assert.match(storeContext, /localStorage\.removeItem\('deviceStoreId'\)/)
assert.match(storeContext, /localStorage\.removeItem\('activeStaff'\)/)

console.log('staff entry checks passed')
