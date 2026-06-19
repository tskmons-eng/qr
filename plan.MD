# QR System Plan

## 2026-06-19 Order reliability architecture review

### Context

- User reported that the restaurant QR ordering system is in a repeated bug-fix cycle and may need to be reconsidered from the mechanism level.
- Current live symptom: when many customers come at once, orders can stop entering.
- User priority: reduce recurring bugs through a coherent ordering design, not patchwork fixes.

### Current Findings

- `npm run check` passes, so the current problem is not exposed by existing source checks.
- The order domain is still split across client services:
  - Customer order start creates `orders`, then updates `tables.currentOrderId`, then optionally creates an auto-added `orderItems` document.
  - Customer cart submit creates `orderItems`, then best-effort updates `tables.pendingCount`.
  - Staff ordering, kitchen served/cancel actions, table detail actions, checkout, and table move actions directly update both `orderItems` and `tables`.
  - Cloud Functions also update `tables.pendingAggregate*` when `orderItems` change.
- This means the same `tables/{tableId}` document is a hot coordination document for session state, pending counts, checkout reset, table move, and aggregate updates.
- Official Firestore guidance warns that high concurrent operations on one document can cause high latency or contention errors; this matches the reported "many customers at once" failure shape.
- Current security rules allow public `orders` and `orderItems` creation, while public `tables` update is only allowed for vacant-to-occupied entry. If two customers start the same table concurrently, one can create an orphan `orders` record and then fail to attach it to the table.
- Functions logs currently show scheduled reservation activity but not order write failures, which is expected because the critical customer order path is mostly client-side Firestore writes.

### Decision

- Do not start with a full UI rewrite. The first rewrite target is the ordering mechanism, because the UI can remain mostly stable while writes are centralized.
- Treat `orderItems` as the durable source of ordered products, and stop using `tables` as a high-frequency counter target.
- Introduce an order command boundary:
  - `startOrderSession`
  - `submitOrderItems`
  - `markItemServed`
  - `cancelOrderItem`
  - `checkoutOrder`
  - `moveOrderTable`
- Each command must be idempotent where customer retry or double-tap is possible.
- Each command must either complete its related writes atomically or leave a recoverable command/error record.
- Keep existing Firestore collections initially to avoid a risky data migration, then move callers behind the command boundary one slice at a time.

### Stabilization Plan

1. Add failure visibility before deeper rewrites.
   - Record customer/staff order write failures with operation name, table id, order id, store id, error code, and timestamp.
   - Keep the customer-facing message simple, but make the admin/debug trail inspectable.

2. Hotfix customer order start.
   - Make `createCustomerOrderSession` transaction/idempotency based.
   - If the table is already occupied with `currentOrderId`, return that order id instead of creating another orphan order.
   - If the table is vacant, create the order and attach it to the table in one transaction.

3. Remove high-frequency table counter dependence.
   - Stop treating `tables.pendingCount` as a source of truth.
   - Use `orderItems` query results or `pendingAggregate*` only for display, with a repair/rebuild path.
   - Avoid client-side `pendingCount` increments on every submit/served/cancel action.

4. Move core order writes to server commands.
   - Implement Cloud Functions callable/HTTPS commands for start, submit, serve, cancel, checkout, and move.
   - Clients call commands instead of writing multiple collections directly.
   - Firestore rules can then be tightened so public clients cannot create arbitrary order data.

5. Add concurrency and retry checks.
   - Emulator test: many customers start the same table at once.
   - Emulator test: many customers submit multiple cart lines for one active order.
   - Emulator test: duplicate submit idempotency key does not duplicate items.
   - Emulator test: checkout during late submit is rejected or queued consistently.
   - Emulator test: served/cancelled counts rebuild from `orderItems`.

6. Decide rebuild scope after the command layer.
   - If errors disappear after centralizing commands, keep the current UI and continue incremental cleanup.
   - If data model issues remain, rebuild backend/data model first and keep route/UI compatibility during migration.

### Investigation Results

- The highest-priority race is customer and staff seating creating an `orders` document before attaching it to `tables.currentOrderId`. A failed or competing table update can leave orphan open orders.
- `tables.pendingCount` is already non-authoritative, and `pendingAggregate*` can also become wrong when checkout resets aggregate fields while `orderItems` can still contain `itemStatus: 'ordered'`.
- Add `src/services/orderCommandService.js` and `src/lib/orderCommands.js` first, then delegate existing services to that boundary while keeping current UI/routes stable.
- Resolve the Functions runtime mismatch before deeper Functions work: `firebase.json` uses `nodejs20`, while `functions/package.json` declares Node `22`.

### Next Implementation Order

1. Hotfix `createCustomerOrderSession` with a Firestore transaction and conflict return, so customer starts cannot create orphan orders.
2. Hotfix `seatGuestsAtTable` with the same transaction guard for staff seating.
3. Add a stale-table confirmation guard to reservation table assignment before it overwrites an occupied table.
4. Add an aggregate audit/repair script before removing legacy `pendingCount` writes.
5. Introduce the order command service boundary and move cart/staff order submit behind it.
6. Add emulator/rules test tooling before tightening public `orders` / `orderItems` create rules.

### Verification Plan

- `npm run check`
- `npm run build`
- Firebase emulator concurrency tests for order commands before production deploy.
- Production deploy only after the command path can be verified without changing visible ordering flow.

### 2026-06-19 Command layer continuation from handoff

#### Current State

- `src/lib/orderCommands.js` and `src/services/orderCommandService.js` have been added as the first command boundary.
- Customer order start, customer cart submit, staff order submit, and staff seating now delegate to the command layer.
- No production deploy, Firestore data deletion, Firestore migration, rules change, or Functions change is part of this step.

#### Checkout Command Plan

- Move `completeCashCheckout` behind `completeCheckoutCommand`.
- Keep existing `checks`, `orders`, `tables`, and `staffActions` collections.
- Use a Firestore transaction to create the check, mark the order checked out, clear only the related table, and record the staff action together.
- Use a deterministic check document id per order so repeated checkout attempts do not create multiple checks.
- Reject mismatched table/order/store state instead of trying to repair live data in this client-side step.

#### Verification

- Review `git diff` for import drift and command-service size.
- Run `npm run check`.
- Run `npm run build`.
- Commit and push only after checks pass.

### 2026-06-19 Finish client command boundary

#### Current State

- Checkout is now delegated to `completeCheckoutCommand`.
- Remaining direct order writes are staff/kitchen served toggles, item cancellation, and table moves.

#### Command Plan

- Add transaction-backed commands for:
  - `markOrderItemServedCommand`
  - `markOrderItemOrderedCommand`
  - `cancelOrderItemCommand`
  - `moveTableOrderCommand`
- Adjust `tables.pendingCount` only from the current item status read inside the transaction:
  - `ordered -> served` decrements once.
  - `served -> ordered` increments once.
  - `ordered -> cancelled` decrements once.
  - Already `served` or `cancelled` states do not double-decrement.
- Keep passcode validation in the staff-table wrapper, then put the item update, table counter update, and `staffActions` write into the command transaction.
- Move table state, `orders.tableId`, and known `orderItems.tableId` together when a table is moved.
- Do not delete Firestore data, run migrations, change rules, change Functions, or deploy hosting/functions in this phase.

#### Verification

- Run `npm run check`.
- Run `npm run build`.
- Confirm no direct order mutation path remains outside the command wrapper except non-order table guest-count/admin flows.
- Commit and push after verification.

### 2026-06-19 Concurrency test responsibility

#### Purpose

- Cover `docs/order-reliability/03-concurrency-tests.md`.
- Add repeatable regression checks for crowded customer entry, retry/double-tap, delayed submit after checkout, and staff concurrent item/table operations.

#### Current State

- The repo uses lightweight `scripts/check-*.mjs` Node checks instead of a dedicated test runner.
- Command writes are already centralized enough to validate the expected semantics without touching production data.
- No Firebase deploy, Firestore migration, Functions change, or production load test is part of this step.

#### Change Plan

- Add a mock command-concurrency check script that models the command invariants with in-memory tables, orders, orderItems, and checks.
- Reuse production command id helpers for idempotent order item document ids.
- Add source guards so the mock expectations stay tied to the transaction/idempotency code paths in the real services.
- Register the check in `package.json` and include it in `npm run check`.

#### Impact Scope

- Test/check tooling and order reliability documentation only.
- Runtime UI and Firestore write behavior should not change in this phase.

#### Verification

- `npm run check:order-concurrency`
- `npm run check`
- `npm run build`

## 2026-06-14 Customer guest auto-add loading guard

### Context

- Customer QR order start can be shown before `storeConfig` finishes loading.
- The guest auto-add setting lives in `storeConfig.guestAutoAdd`.
- If a customer starts from the guest-count screen while the config is still at defaults, the order session is created with auto-add effectively OFF even though the store has configured it.

### Decision

- Treat table loading and store-config loading as separate required startup work.
- Do not render the guest-count, menu, cart, or complete routes until the current table's store config has loaded.
- Reset config state when a different QR token/store is loaded so stale config from another store cannot leak into the order start.
- Keep the existing guest auto-add UI and order creation shape unchanged.

### Verification Plan

- Add a source check that asserts the order entry route waits on `configLoading`.
- Run `npm run check:customer-entry`.
- Run `npm run check`.
- Run `npm run build`.
- Commit and push the fix.

### Verification Results

- `npm run check:customer-entry` passed.
- `npm run check` passed.
- `npm run build` passed.
- Local Vite served `/order/__codex_missing_qr__/guests`; the route rendered the expected invalid-QR state with no browser console errors.
- `npx --yes firebase-tools deploy --only hosting --project qrproduct-3340b --non-interactive` completed.
- Live hosting HTML references the deployed asset `assets/index-BmWfh4Tr.js`.

## 2026-06-14 Google login redirect hotfix

### Context

- Google login stopped working after the latest live update.
- Live verification showed the login page renders without app errors and OAuth can start, but popup completion is unreliable.
- User priority: fix login without disturbing people currently using the store screens.
- Follow-up report: desktop login works, but the Google login button can become unpressable in another environment.

### Decision

- Limit the change to Google login flow only.
- Replace popup-based Google sign-in with redirect-based sign-in.
- After redirect completion, send non-anonymous Google users back to `/staff`.
- Do not touch seat, kitchen, menu, order, or checkout behavior in this hotfix.
- Do not set the shared login `loading` state when Google redirect starts, because a stalled redirect can leave the button disabled.

### Verification Plan

- Run production build.
- Confirm `/login` renders locally without new console errors beyond existing React Router future warnings.
- Deploy hosting only after build succeeds.
- Confirm live `/login` returns the new asset and renders.
- Commit and push the hotfix.

### Verification Results

- `npm run build` passed.
- `npm run check` passed.
- Local `/login` rendered in the in-app browser; only existing React Router future warnings appeared.
- `npx --yes firebase-tools deploy --only hosting --project qrproduct-3340b --non-interactive` completed.
- Live `/login` returned `assets/index-YM8taRxf.js` and rendered the Google login button.
- Follow-up button-state fix deployed; live `/login` now returns `assets/index-CpJsCPKd.js`, and the Google button is enabled with no blocking overlay or console error.

## 2026-06-13 Seat and data loading performance guardrails

### Context

- Some staff/customer screens occasionally take a long time to load seat or store data.
- User priority: performance fixes must not change existing features, screen layout, visual design, navigation, button placement, or normal operation flow.
- Faster loading should feel like the same system becoming more responsive, not like a redesigned workflow.

### Decision

- Preserve current UI and behavior while improving Firestore reads.
- Start with low-risk infrastructure changes such as Firestore indexes and query narrowing.
- Do not remove an existing live subscription until a staged comparison confirms the replacement data path is accurate.
- Keep kitchen/order/detail screens functionally unchanged; optimize only the data-fetching layer unless a visible change is explicitly approved.
- If aggregate fields such as table pending counts are expanded, provide a repair or verification path before relying on them as the only source of truth.
- During live store use, avoid disruptive swaps: deploy additive fields/functions/indexes first, keep old reads as fallback for already-open sessions, and let new sessions move to the faster path.

### Verification Plan

- Confirm the staff table list, kitchen, table detail, customer menu, cart, and checkout flows still render the same visible states.
- Run the relevant source checks and production build before deploy.
- Commit and push every file change.

### Implementation Notes

- Add `pendingAggregateCount`, `pendingAggregateDrinkCount`, and `pendingAggregateFoodCount` beside legacy `pendingCount`; do not repurpose `pendingCount`.
- Use a Cloud Function to maintain aggregate fields from `orderItems`, so unauthenticated QR orders do not depend on table update permissions.
- Staff table list uses aggregate fields only when `pendingAggregateVersion` is present; already-open legacy sessions keep the old `orderItems` fallback.
- Add persistent Firestore web cache and query narrowing where the visible result is identical.

### Verification Results

- `npm run check` passed.
- `npm run build` passed.
- `node --check functions/index.js` passed.
- Local `/staff` rendered in the in-app browser with no console errors.
- `npx --yes firebase-tools deploy --only firestore:indexes --project qrproduct-3340b --non-interactive` completed.
- Added aggregate Cloud Functions were created in `asia-northeast1`; existing `notifyStaff` remained deployed.
- Artifact cleanup policy for `asia-northeast1` was set after the Functions deploy warning.
- `npx --yes firebase-tools deploy --only hosting --project qrproduct-3340b --non-interactive` completed.
- Live `/staff` returned the deployed asset `assets/index-D6kOGVZG.js` and rendered with no console errors.

## 2026-06-13 Staff store-management menu consolidation

### Context

- Staff header buttons had grown too wide as management actions were added individually.
- User priority: keep the operational UI smart and compact by grouping history, seats, menu management, register closing, and related admin tools under a single `店舗管理` entry.
- User priority: refresh should feel like Safari pull-to-refresh from the top of the staff page and must be visually understandable while pulling.
- In app/PWA use, the bottom staff navigation should sit just slightly above the physical bottom edge for readability.

### Decision

- Keep daily operation buttons visible: `注文`, staff switch, kitchen, and logout.
- Remove the header refresh button because it consumes prime action space and is not part of the normal order flow.
- Preserve refresh access in app use with a compact pull-to-refresh gesture on the staff shell, including `下に引いて更新`, `離すと更新`, and `更新中...` states.
- Move elevated/admin actions into one permission-aware `店舗管理` popover in the staff shell header.
- Move sound and device notification controls into the existing settings screen; remove the separate header gear button.
- Preserve the existing `/staff/...` routes and permission gates so deep links and current page behavior continue to work.
- Raise customer/staff fixed bottom navigation by a small offset while preserving safe-area padding.

### Verification Plan

- Update the staff permission source check to assert the grouped management menu remains wired.
- Assert the refresh button stays removed and the pull-to-refresh UI remains wired.
- Run `npm run check:staff-permissions`.
- Run `npm run build`.
- Verify the staff screen in a mobile viewport.
- Commit and push the change.

### Verification Results

- `npm run check:staff-permissions` passed.
- `npm run check` passed.
- `npm run build` passed.
- Local Vite served `/staff` in a mobile viewport and reached the existing store-code entry screen with only existing React Router future warnings.
- Source assertions confirm the staff shell no longer emits the direct `更新` button and keeps the pull-to-refresh DOM/CSS wired.

## 2026-06-13 Admin settings device sound controls

### Context

- The settings menu already hosts store-level workflow controls.
- Users expect call sound and notification sound choices to be reachable from that settings surface instead of only from per-screen popups.
- Existing sound preferences are device-local so hall and kitchen terminals can keep different sound and volume choices.
- The old header gear still owned only the device notification registration toggle, so keeping it would leave a duplicate settings path.

### Decision

- Add a device sound section to `SettingsPage`.
- Reuse `lib/sounds.js` sound IDs, preview playback, and localStorage persistence.
- Keep the store-wide notification toggle in the existing workflow settings.
- Show the device notification ON/OFF registration control inside settings when the page is opened from the staff shell.
- Remove the old staff header gear popup and its dead CSS/component files.

### Verification Plan

- Run `npm run check:settings`.
- Run `npm run build`.
- Commit and push the change.

### Verification Results

- `npm run check:settings` passed.
- `npm run check:staff-permissions` passed.
- `npm run build` passed.
- Local Vite served `/login` successfully with no new browser console errors; `/admin/settings` remains behind the existing logged-in protected route.

## 2026-06-13 Customer QR checkout reset guard

### Context

- After staff checkout, a customer revisiting an old QR child URL such as `/menu` or `/complete` could avoid the normal `/guests` entry route.
- A vacant table has no active `currentOrderId`, so those child screens should not load menu products or order status data.
- Live read-only verification confirmed the base QR URL redirects to `/guests`, while a stale `/menu` URL could still load the menu for a vacant table.

### Decision

- Guard customer QR child routes in `OrderEntryPage`.
- If there is no active `orderId`, redirect `/menu`, `/cart`, and `/complete` to `/guests`.
- If there is already an active `orderId`, redirect `/guests` to `/menu`.

### Verification Plan

- Run `npm run check:customer-entry`.
- Run `npm run build`.
- Verify a vacant table's stale `/menu` and `/complete` URLs redirect to `/guests` after deploy.

### Verification Results

- `npm run check:customer-entry` passed in a clean deploy worktree.
- `npm run check` passed in a clean deploy worktree.
- `npm run build` passed in a clean deploy worktree.
- `npx --yes firebase-tools deploy --only hosting --project qrproduct-3340b --non-interactive` completed from the clean deploy worktree.
- Live hosting HTML references `assets/index-wnV88Uo6.js`.
- A vacant table's stale `/menu` URL redirected to `/guests`.
- A vacant table's stale `/complete` URL redirected to `/guests`.

## 2026-06-13 Staff admin order-screen return button

### Context

- Staff management can be opened inside the staff shell at `/staff/staff-admin`.
- Users need an obvious way to return from staff/admin tools to the order-taking table list.
- The order-taking entry point is `/staff`.

### Decision

- Add a persistent `注文` button to the staff shell header.
- Keep the destination scoped to `/staff` and avoid changing staff permission or admin page logic.

### Verification Plan

- Run `npm run check:staff-permissions`.
- Run `npm run build`.
- Commit and push the change.

### Verification Results

- `npm run check:staff-permissions` passed.
- `npm run build` passed.
- Local Vite server loaded `/staff/staff-admin` to the staff entry screen; the logged-in header path is covered by the source assertion for `onOpenOrders` and the `注文` button.

## 2026-06-13 Customer order false error hotfix

### Context

- Users reported that QR customer orders reached kitchen/register screens, but the customer screen still showed an error.
- Local inspection found `submitCustomerCartOrder` creates `orderItems` first, then updates `tables.pendingCount`.
- Firestore rules allow public `orderItems` creation, while table updates are restricted except for initial seating.

### Decision

- Keep customer order item creation unchanged.
- Treat `tables.pendingCount` sync as non-critical after `orderItems` creation succeeds.
- Do not change Firestore rules during active production use.

### Verification Plan

- Run `npm run check:customer-cart`.
- Run `npm run check:customer-entry`.
- Run `npm run build`.
- Commit and push the hotfix.
- Deploy hosting only if Firebase tooling/auth is available from this machine.

### Verification Results

- `npm run check:customer-cart` passed.
- `npm run check:customer-entry` passed.
- `npm run check` passed.
- `npm run build` passed.
- `npx --yes firebase-tools deploy --only hosting --project qrproduct-3340b --non-interactive` completed.
- Live hosting HTML references the deployed build assets `assets/index-CzkQ-u9w.js` and `assets/index-D6g3bT6Z.css`.

## 2026-06-15 Reservation arrival notices and waiting guidance

### Context

- Reservations need two staff-wide notices: one when a reservation is registered, and one 10 minutes before the reservation time.
- Users want the staff floor to see unresolved reservation arrivals until someone intentionally handles them.
- Seat assignment must stay optional because seats may be created later, but a specified vacant seat can be used automatically.
- If the specified seat is occupied or the reservation has no seat, the system should not force a seat. It should leave a visible waiting notice with actions to open the seat, choose another seat, or dismiss the notice.

### Decision

- Store `reservationAt`, `arrivalNoticeAt`, `arrivalNoticeStatus`, and `waitingStatus` fields on new reservations.
- Use Cloud Functions to notify on creation and run the 10-minute-before arrival workflow every minute.
- Auto-seat only when a reservation has a specified table and that table is vacant.
- For seat conflicts or unassigned reservations, set `waitingStatus: pending` and show a staff-shell banner across staff pages.
- Staff can guide a waiting reservation to any table. Vacant tables create a new order session; occupied tables require confirmation and overwrite the table/current order guest count to the reservation count.
- Staff table list and kitchen show today's confirmed reservations as `予約あり`, including time and party size.
- Keep reservation edit permissions under `manageReservations`; only the narrow waiting-notice handling fields can be updated by logged-in store staff.

### Verification Plan

- Run `npm run check:reservation-display`.
- Run `npm run check`.
- Run `npm run build`.
- Browser-check `/staff/reservations`, `/staff`, and `/staff/kitchen`.
- Deploy Firestore rules/indexes, Functions, and Hosting, then commit and push `codex/reservation-arrival-notices`.
