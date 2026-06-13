# QR System Plan

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
