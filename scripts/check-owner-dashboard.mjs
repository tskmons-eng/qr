import assert from 'node:assert/strict'
import {
  buildOwnerDashboardSnapshot,
  formatOwnerCurrency,
  formatOwnerDateTime,
  getOwnerBusinessDate,
  isOwnerSameBusinessDay,
  ownerDateFromTimestamp,
} from '../src/lib/ownerDashboard.js'

const date = new Date(2026, 5, 1, 12, 0, 0)
const todayTimestamp = { seconds: new Date(2026, 5, 1, 10, 30, 0).getTime() / 1000 }
const oldTimestamp = { seconds: new Date(2026, 4, 31, 22, 0, 0).getTime() / 1000 }

assert.equal(getOwnerBusinessDate(date), '2026-06-01')
assert.equal(ownerDateFromTimestamp(todayTimestamp).getFullYear(), 2026)
assert.equal(isOwnerSameBusinessDay(todayTimestamp, date), true)
assert.equal(isOwnerSameBusinessDay(oldTimestamp, date), false)
assert.equal(formatOwnerCurrency(12345), '¥12,345')
assert.equal(formatOwnerDateTime(todayTimestamp).includes('2026'), true)

const dashboard = buildOwnerDashboardSnapshot({
  stores: [
    { id: 'store-a', storeName: 'A店', storeCode: 'ABC123', ownerEmail: 'owner-a@example.com', isOpen: true, createdAt: oldTimestamp },
    { id: 'store-b', storeName: '', storeCode: 'DEF456', isOpen: false, createdAt: todayTimestamp },
  ],
  checks: [
    { storeId: 'store-a', status: 'completed', total: 1200, completedAt: todayTimestamp },
    { storeId: 'store-a', status: 'completed', total: 800, completedAt: oldTimestamp },
    { storeId: 'store-a', status: 'void', total: 9999, completedAt: todayTimestamp },
    { storeId: 'store-b', status: 'completed', total: 3000, completedAt: todayTimestamp },
  ],
  orders: [
    { storeId: 'store-a', status: 'open', openedAt: todayTimestamp },
    { storeId: 'store-a', status: 'checked_out', openedAt: oldTimestamp },
  ],
}, date)

assert.equal(dashboard.summary.storeCount, 2)
assert.equal(dashboard.summary.activeStoreCount, 1)
assert.equal(dashboard.summary.todaySales, 4200)
assert.equal(dashboard.summary.todayCheckCount, 2)
assert.equal(dashboard.summary.openOrderCount, 1)
assert.equal(dashboard.stores.find(store => store.id === 'store-a').allTimeSales, 2000)
assert.equal(dashboard.stores.find(store => store.id === 'store-a').ownerEmail, 'owner-a@example.com')
assert.equal(dashboard.stores.find(store => store.id === 'store-b').storeName, '店舗名未設定')

console.log('owner dashboard checks passed')
