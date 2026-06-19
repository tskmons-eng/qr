import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const checks = [
  {
    file: 'src/services/customerEntryService.js',
    required: ["startCustomerOrderSession"],
    forbidden: [
      "addDoc(collection(db, 'orders')",
      "updateDoc(doc(db, 'tables'",
      "addDoc(collection(db, 'orderItems')",
    ],
  },
  {
    file: 'src/services/customerCartService.js',
    required: ["submitCustomerOrderItems"],
    forbidden: [
      "addDoc(collection(db, 'orderItems')",
      'pendingCount',
    ],
  },
  {
    file: 'src/services/staffMenuService.js',
    required: ["submitStaffOrderItems"],
    forbidden: [
      "addDoc(collection(db, 'orderItems')",
      'pendingCount',
    ],
  },
  {
    file: 'src/services/checkoutService.js',
    required: ["completeCheckoutCommand"],
    forbidden: [
      "addDoc(collection(db, 'checks')",
      "updateDoc(doc(db, 'orders'",
      "updateDoc(doc(db, 'tables'",
      "addDoc(collection(db, 'staffActions')",
    ],
  },
  {
    file: 'src/services/staffTableService.js',
    required: [
      'markOrderItemServedCommand',
      'markOrderItemOrderedCommand',
      'cancelOrderItemCommand',
      'moveTableOrderCommand',
      'seatStaffOrderSession',
    ],
    forbidden: [
      "doc(db, 'orderItems'",
      'writeBatch',
      'pendingCount: increment',
    ],
  },
  {
    file: 'src/services/kitchenService.js',
    required: [
      'markOrderItemServedCommand',
      'markOrderItemsServedCommand',
      'cancelOrderItemCommand',
    ],
    forbidden: [
      "doc(db, 'orderItems'",
      'updateDoc',
      'pendingCount',
      "addDoc(collection(db, 'staffActions')",
    ],
  },
]

for (const check of checks) {
  const text = await readFile(check.file, 'utf8')
  for (const token of check.required) {
    assert.ok(text.includes(token), `${check.file} should delegate through ${token}`)
  }
  for (const token of check.forbidden) {
    assert.ok(!text.includes(token), `${check.file} should not contain ${token}`)
  }
}

console.log('order command boundary checks passed')
