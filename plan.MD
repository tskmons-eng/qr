# QR System Plan

## 2026-06-13 Admin settings device sound controls

### Context

- The settings menu already hosts store-level workflow controls.
- Users expect call sound and notification sound choices to be reachable from that settings surface instead of only from per-screen popups.
- Existing sound preferences are device-local so hall and kitchen terminals can keep different sound and volume choices.

### Decision

- Add a device sound section to `SettingsPage`.
- Reuse `lib/sounds.js` sound IDs, preview playback, and localStorage persistence.
- Keep the store-wide notification toggle in the existing workflow settings; only sound choice and volume are edited in the new section.

### Verification Plan

- Run `npm run check:settings`.
- Run `npm run build`.
- Commit and push the change.

### Verification Results

- `npm run check:settings` passed.
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
