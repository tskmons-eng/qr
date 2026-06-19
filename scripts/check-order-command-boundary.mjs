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
  {
    file: 'src/services/orderCommandService.js',
    required: [
      'withOrderCommandFailureLog',
      "commandType: 'start_customer_order_session'",
      "commandType: 'customer_submit_items'",
      "commandType: 'staff_submit_items'",
      "commandType: 'seat_staff_order_session'",
      "commandType: 'complete_checkout'",
    ],
    forbidden: [],
  },
  {
    file: 'src/services/orderItemCommandService.js',
    required: [
      'withOrderCommandFailureLog',
      "commandType: 'mark_item_served'",
      "commandType: 'mark_items_served'",
      "commandType: 'mark_item_ordered'",
      "commandType: 'cancel_order_item'",
    ],
    forbidden: [],
  },
  {
    file: 'src/services/tableMoveCommandService.js',
    required: [
      'withOrderCommandFailureLog',
      "commandType: 'move_table_order'",
    ],
    forbidden: [],
  },
  {
    file: 'src/services/orderCommandFailureService.js',
    required: [
      'recordOrderCommandFailure',
      'orderCommandFailures',
      'buildOrderCommandFailurePayload',
    ],
    forbidden: [],
  },
  {
    file: 'firestore.rules',
    required: [
      'validOrderCommandFailure',
      'match /orderCommandFailures/{failureId}',
    ],
    forbidden: [],
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
