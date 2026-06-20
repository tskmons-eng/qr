import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { formatOrderCommandError, getOrderCommandErrorCode } from '../src/lib/orderCommandErrors.js'

assert.equal(getOrderCommandErrorCode({ code: 'target-table-not-vacant' }), 'target-table-not-vacant')
assert.equal(
  formatOrderCommandError({ code: 'target-table-not-vacant' }, { context: 'tableMove' }).message,
  '移動先の席がすでに埋まっています。別の空席を選んでください。'
)
assert.equal(
  formatOrderCommandError({ code: 'unknown-command-code' }, { context: 'customerSubmit' }).message,
  '注文を送信できませんでした。もう一度お試しください。'
)
assert.equal(formatOrderCommandError({ code: 'order-not-open' }).retryable, false)
assert.equal(formatOrderCommandError({ code: 'unavailable' }).retryable, true)

const sourceAssertions = [
  {
    file: 'src/pages/order/GuestCountPage.jsx',
    required: ['formatOrderCommandError(error, { context: \'customerStart\' })', 'errorMessage={commandError}', 'operation: \'customer_start_order\''],
    forbidden: ['alert(\'エラーが発生しました。もう一度試してください。\')'],
  },
  {
    file: 'src/pages/order/CartPage.jsx',
    required: ['formatOrderCommandError(error, { context: \'customerSubmit\' })', 'errorMessage={submitError}', 'operation: \'customer_submit_order\''],
    forbidden: ['alert(\'送信に失敗しました。もう一度試してください。\')'],
  },
  {
    file: 'src/pages/staff/StaffMenuPage.jsx',
    required: ['formatOrderCommandError(error, { context: \'staffSubmit\' })', 'errorMessage={submitError}', 'operation: \'staff_submit_order\'', 'useStaffMember()', 'activeStaff,'],
    forbidden: ['alert(\'送信に失敗しました\')'],
  },
  {
    file: 'src/services/orderCommandService.js',
    required: ['export async function submitStaffOrderItems({ activeStaff, cart, orderId, storeId, tableId, clientRequestId })', 'const payload = { activeStaff, cart, orderId, storeId, tableId, clientRequestId: requestId }'],
    forbidden: [],
  },
  {
    file: 'src/lib/orderCommandPayloads.js',
    required: ['orderedByStaffId: activeStaff?.id ?? null', 'orderedByStaffName: activeStaff?.name ?? null'],
    forbidden: [],
  },
  {
    file: 'functions/orderCommandShared.js',
    required: ['function buildStaffOrderItemPayload({ activeStaff, cartItem, orderId, storeId, tableId, timestamp })', 'orderedByStaffId: activeStaff?.id ?? null', 'orderedByStaffName: activeStaff?.name ?? null'],
    forbidden: [],
  },
  {
    file: 'functions/orderCommandHandlers.js',
    required: ['async function submitStaffOrderItems({ activeStaff, cart, orderId, storeId, tableId, clientRequestId }, request)', 'activeStaff,'],
    forbidden: [],
  },
  {
    file: 'src/pages/staff/TableDetailPage.jsx',
    required: ['formatOrderCommandError(error, { context: \'tableMove\' })', 'errorMessage={moveError}', 'OrderCommandErrorNotice message={actionError}'],
    forbidden: ['alert(\'移動に失敗しました\')', 'alert(\'エラーが発生しました\')'],
  },
  {
    file: 'src/pages/staff/CheckoutPage.jsx',
    required: ['formatOrderCommandError(error, { context: \'checkout\' })', 'errorMessage={checkoutError}', 'operation: \'complete_checkout\''],
    forbidden: ['alert(\'エラーが発生しました。もう一度試してください。\')'],
  },
  {
    file: 'src/pages/kitchen/KitchenPage.jsx',
    required: [
      'handleMarkServed',
      'handleMarkAllServed',
      'OrderCommandErrorNotice message={commandError}',
      'optimisticHiddenItemIds',
      'addOptimisticHiddenKitchenItemIds',
      'removeOptimisticHiddenKitchenItemIds',
      'pruneOptimisticHiddenKitchenItemIds',
      'filterOptimisticHiddenKitchenItems(pendingItems, optimisticHiddenItemIds)',
    ],
    forbidden: ['KitchenServedUndoBar', 'handleUndoServed', 'operation: \'kitchen_undo_served\''],
  },
  {
    file: 'src/services/kitchenService.js',
    required: [
      'markOrderItemsServedCommand',
      'markOrderItemServedCommand',
    ],
    forbidden: [
      'updateDoc',
      'markKitchenItemsOrdered',
    ],
  },
]

for (const assertion of sourceAssertions) {
  const source = readFileSync(assertion.file, 'utf8')
  for (const token of assertion.required) {
    assert.ok(source.includes(token), `${assertion.file} is missing ${token}`)
  }
  for (const token of assertion.forbidden) {
    assert.ok(!source.includes(token), `${assertion.file} still contains ${token}`)
  }
}

console.log('order command UI checks passed')
