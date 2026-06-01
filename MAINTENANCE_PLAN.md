# QR System Maintenance Plan

## User Priority

The application is already in use, so refactoring must not change production behavior accidentally. The priority is to reduce file bloat, separate CSS and driving logic, and make future bug checks and feature additions easier without disrupting current users.

Typography should use `M PLUS Rounded 1c` as the main font for a rounded, strong Gothic admin feel. Body text should stay slightly heavy, labels and buttons should be bold, and totals or important numeric values should use weight 900 with tabular numbers. Fallbacks are `Noto Sans JP`, `Yu Gothic UI`, `Meiryo`, `system-ui`, and sans-serif.

## Current Hotspots

- No source file currently exceeds the structure-audit threshold.
- Selected admin/customer CSS files are below the threshold but close enough to avoid growing them further.
- `src/styles/staff-login.css`, `src/styles/customer-menu.css`, `src/styles/option-modal.css`, and selected customer/staff CSS files are below the threshold but should be split before adding more visual states.
- `src/pages` and `src/components` currently have no inline `style={{ ... }}` usage and no direct Firestore/Auth SDK calls; those are routed through services and CSS classes.

## Refactor Rules

1. Keep production behavior unchanged unless a separate bug fix is explicitly intended.
2. Prefer extracting pure helpers and non-visual service logic before moving JSX.
3. Keep Firestore writes and schema-compatible field names intact.
4. After every slice, run `npm run build`.
5. Do not deploy until the local diff is reviewed and the build is clean.
6. When a user priority or design decision appears, update this file before continuing large edits.

## Target Shape

- `src/lib/`: pure calculations, PDF generation, formatting, and browser API helpers.
- `src/services/`: Firestore read/write workflows that are shared or complex.
- `src/hooks/`: page-level state machines and subscriptions.
- `src/components/`: reusable UI pieces with minimal business logic.
- `src/styles/`: CSS tokens, base rules, shared components, and page-specific CSS modules when needed.
- `src/pages/`: route composition only; pages should mostly wire hooks, services, and components together.

## Completed Refactor Slices

- Extracted QR poster PDF generation from `src/pages/admin/TablePage.jsx` into `src/lib/qrPosterPdf.js`.
- Created `src/styles/` with `tokens.css` and `base.css`, imported through `src/index.css`.
- Extracted product form normalization from `src/pages/admin/ProductPage.jsx` into `src/lib/productForm.js`.
- Extracted shared sort-order calculations into `src/lib/sortOrder.js`.
- Extracted checkout total calculations into `src/lib/checkoutCalculations.js`.
- Extracted product admin data loading and template CRUD into `src/services/productAdminService.js`.
- Moved ProductPage product/category Firestore writes and reorder batches into `src/services/productAdminService.js`.
- Extracted ProductPage tab controls, form shell, category selector, basic fields, image picker, tag editor, tag template tools, product list rows, category management, discount editor, options editor, and related-products editor into focused admin components.
- Moved touch-based product/category reorder state into `src/hooks/useTouchReorder.js`.
- Split admin CSS into purpose-specific files: core, table/dialog, shared admin controls, product list/category, product form base, product discount, product options, and product related-products.
- Extracted staff table order sections and table order summary from `src/pages/staff/TableDetailPage.jsx` into focused staff components, with matching `staff-table-detail.css`.
- Extracted `TableDetailPage` cancellation modal, move-table modal, header/guest editor, seating panel, and bottom action bar into focused staff components.
- Moved `TableDetailPage` table/order write workflows into `src/services/staffTableService.js`.
- Split staff table CSS into shell, modal, and order-specific files.
- Extracted StaffLayout staff login screen and sound settings panel into focused staff components, reducing `StaffLayout.jsx` below the structure-audit threshold.
- Moved `CheckoutPage` Firestore checkout completion and data loading into `src/services/checkoutService.js`.
- Extracted `CheckoutCompleteScreen` and added `staff-checkout.css`, reducing `CheckoutPage.jsx` below the structure-audit threshold.
- Extracted `CheckoutPage` header, discount list, item-discount modal, payment panel, and confirmation bar into focused staff checkout components.
- Split checkout CSS into `staff-checkout-complete.css`, `staff-checkout-layout.css`, `staff-checkout-payment.css`, and `staff-checkout-modal.css`, imported through `staff-checkout.css`.
- Moved kitchen served/cancel workflows into `src/services/kitchenService.js`.
- Extracted kitchen notification sound settings into `KitchenSoundPanel` and `staff-kitchen.css`, reducing `KitchenPage.jsx` below the structure-audit threshold.
- Moved ProductPage option-editing state into `src/hooks/useProductOptionForm.js`.
- Moved ProductPage category/quick-category state and category CRUD/reorder workflows into `src/hooks/useProductCategoryAdmin.js`.
- Moved ProductPage product form/image state into `src/hooks/useProductFormState.js`.
- Moved ProductPage product save/image/visibility/reorder workflows into `src/hooks/useProductActions.js`.
- Moved ProductPage option/tag template orchestration into `src/hooks/useProductTemplateAdmin.js`.
- Extracted ProductPage product and category tab composition into `ProductProductsTab` and `ProductCategoriesTab`, reducing `ProductPage.jsx` below the structure-audit threshold.
- Moved ReservationPage Firestore reads/writes into `src/services/reservationAdminService.js`, reducing `ReservationPage.jsx` below the structure-audit threshold.
- Moved ReservationPage calendar helpers into `src/lib/reservationCalendar.js`.
- Extracted ReservationPage calendar, detail panel, form, and list into focused admin components.
- Split ReservationPage CSS into calendar and detail files imported through `admin-reservations.css`.
- Moved MenuPage menu reads and call writes into `src/services/customerMenuService.js`.
- Extracted MenuPage header, category tabs, product list, and floating cart button into focused customer order components.
- Moved MenuPage inline styles into `src/styles/customer-menu.css`.
- Moved StaffMenuPage order submission writes into `src/services/staffMenuService.js`.
- Reused customer menu loading from `src/services/customerMenuService.js` for StaffMenuPage menu reads.
- Extracted StaffMenuPage header, category tabs, product list, and submit bar into focused staff components.
- Moved StaffMenuPage inline styles into `src/styles/staff-menu.css`, reducing `StaffMenuPage.jsx` to route composition and cart flow.
- Moved OptionModal quantity normalization, option selection building, confirm readiness, and multi-choice total calculations into `src/lib/optionModal.js`.
- Extracted OptionModal header, group selection, multi-quantity list, quantity control, summary, and actions into focused shared components.
- Moved OptionModal inline styles into `src/styles/option-modal.css`.
- Added `npm run check:option-modal` to cover the extracted option modal calculations.
- Moved staff-member loading from `StaffLoginScreen` into `src/services/staffAuthService.js`.
- Moved StaffLoginScreen and SoundSettingsPanel inline styles into `staff-login.css` and `sound-settings.css`, imported through `staff-auth.css`.
- Moved StaffLayout pending-call subscription and call response transaction into `src/services/staffCallService.js`.
- Extracted StaffLayout shell header and call notification banner into focused staff components, with `staff-shell.css`.
- Moved SettingsPage store config, store code, and allowed-email Firestore workflows into `src/services/settingsService.js`.
- Moved SettingsPage toggle definitions, defaults, email validation, and included-tax calculation into `src/lib/settingsConfig.js`.
- Extracted SettingsPage store-code, customer display toggles, tax-rate controls, save button, and allowed-email management into focused admin components.
- Split SettingsPage CSS into `admin-settings-core.css` and `admin-settings-email.css`, imported through `admin-settings.css`.
- Added `npm run check:settings` to cover extracted settings helpers.
- Moved OrderCompletePage order item subscription into `src/services/customerOrderStatusService.js`.
- Moved customer order status defaults, summary totals, per-person calculation, status labels, and checkout confirmation copy into `src/lib/customerOrderStatus.js`.
- Extracted OrderCompletePage header, total panel, status summary, order list, additional-order bar, and floating call button into focused order components.
- Moved OrderCompletePage inline styles into `src/styles/customer-order-status.css`, reducing the page to route composition and call flow.
- Moved CustomerBottomNav and StaffBottomNav inline styles into `src/styles/bottom-nav.css`.
- Moved StaffPage staff member CRUD into `src/services/staffAuthService.js`.
- Moved StaffPage code normalization and validation into `src/lib/staffMember.js`.
- Extracted StaffPage add form and staff list into focused admin components with `admin-staff.css`.
- Added `npm run check:customer-order-status` and `npm run check:staff-member` for extracted customer order and staff member helpers.
- Moved TablePage table subscription, table creation, QR reissue, and table rename writes into `src/services/adminTableService.js`.
- Moved TablePage QR token generation, table status labels, table-name normalization, and order URL building into `src/lib/adminTable.js`.
- Extracted TablePage QR dialog and table row editing into focused admin components.
- Added `npm run check:admin-table` for extracted table helpers.
- Moved TableListPage table/pending-order subscriptions into `src/services/staffTableListService.js`.
- Moved TableListPage pending-count grouping, status selection, and elapsed-time formatting into `src/lib/staffTableList.js`, with shared `useNow`.
- Extracted staff table-list empty state and table cards into focused staff components with `staff-table-list.css`.
- Added `npm run check:staff-table-list` for extracted staff table-list helpers.
- Moved CartPage customer order submission writes into `src/services/customerCartService.js`.
- Moved CartPage option formatting, quantity normalization, line pricing, and customer order item payload building into `src/lib/customerCart.js`.
- Extracted CartPage header, cart item list, and submit bar into focused order components with `customer-cart.css`.
- Moved SuggestionSheet inline styles into `src/styles/suggestion-sheet.css`.
- Added `npm run check:customer-cart` for extracted cart helpers.
- Moved SalesPage Firestore load/レジ締め writes into `src/services/adminSalesService.js`.
- Moved SalesPage business-date filtering, summary totals, sorting, and CSV row building into `src/lib/adminSales.js`.
- Extracted SalesPage header, summary cards, today-check list, cash-closing panel, and closing history into focused admin components with `admin-sales.css`.
- Added `npm run check:admin-sales` for extracted sales helpers.
- Moved OwnerPage allowed-email subscription and writes into `src/services/ownerAccessService.js`.
- Moved OwnerPage email normalization, validation, sort order, and date formatting into `src/lib/ownerAccess.js`.
- Extracted OwnerPage header, allowed-email form, and allowed-email list into focused owner components with `owner.css`.
- Added `npm run check:owner-access` for extracted owner access helpers.
- Moved KitchenPage table and pending-item subscriptions into `src/services/kitchenService.js`.
- Moved KitchenPage filter handling, wait-time formatting, wait-level selection, ordering, and notification new-item filtering into `src/lib/kitchenDisplay.js`.
- Extracted KitchenPage header, empty state, table grid, table cards, and item rows into focused staff components.
- Moved KitchenPage inline styles into `src/styles/staff-kitchen.css`.
- Split kitchen CSS into layout, table, and sound files imported through `staff-kitchen.css`.
- Added `npm run check:kitchen-display` for extracted kitchen display helpers.
- Moved TableDetailPage table and order-item subscriptions into `src/services/staffTableService.js`.
- Moved TableDetailPage item filtering, item sorting, status grouping, total calculation, and guest-step calculation into `src/lib/staffTableDetail.js`.
- Added `npm run check:staff-table-detail` for extracted table-detail helpers.
- Moved RemainingPage table/order subscriptions and served-item updates onto the shared staff table service, and moved its layout into `staff-remaining.css`.
- Moved shared table option text formatting into `src/lib/staffTableDetail.js` for both table detail and remaining-order views.
- Moved OrderEntryPage QR table subscription, store-config loading, and GuestCountPage customer order creation into `src/services/customerEntryService.js`.
- Moved customer entry defaults, guest-count bounds, and optimistic table-state update helpers into `src/lib/customerEntry.js`, with `customer-entry.css` for entry/guest screens.
- Moved StaffEntryPage store-code normalization, saved-code handling helpers, and staff-session creation into `src/lib/staffEntry.js` and `src/services/staffEntryService.js`, with `staff-entry.css`.
- Moved LoginPage email/Google sign-in into `src/services/staffLoginService.js` and split its form/button UI into focused staff components.
- Moved HistoryPage staff action/check loading into `src/services/adminHistoryService.js`, with merge/filter/export helpers in `src/lib/adminHistory.js`.
- Extracted HistoryPage header, filters, and list into focused admin components with `admin-history.css`.
- Moved legacy CategoryPage category subscription/create/toggle workflows into `src/services/adminCategoryService.js`, with helper payload builders in `src/lib/adminCategory.js`.
- Extracted legacy CategoryPage form/list into focused admin components with `admin-category.css`.
- Moved AdminLayout store-code loading and sign-out through services, replacing inline layout/tab styles with `admin-layout.css`.
- Moved ApprovalGate allowed-email lookup and sign-out through `src/services/authSessionService.js`, replacing inline styles with `approval-gate.css`.
- Moved remaining ProductPage row drag, move button, section toggle, and section-save inline styling into CSS classes.
- Split admin product CSS further into product list, category management, form base, media, and section-control files so the structure audit has no over-threshold source files.
- Added `npm run check:customer-entry`, `npm run check:staff-entry`, `npm run check:admin-history`, and `npm run check:admin-category` for the newly extracted helpers.
- Moved image conversion/compression libraries behind dynamic imports and split vendor chunks in `vite.config.js`, removing the build chunk warning while keeping HEIC conversion lazy-loaded.
- Added `npm run check:product-form`, `npm run check:sort-order`, `npm run check:checkout`, `npm run check:option-modal`, `npm run check:settings`, `npm run check:customer-entry`, `npm run check:customer-order-status`, `npm run check:customer-cart`, `npm run check:staff-member`, `npm run check:staff-entry`, `npm run check:admin-table`, `npm run check:admin-category`, `npm run check:staff-table-list`, `npm run check:admin-sales`, `npm run check:admin-history`, `npm run check:owner-access`, `npm run check:kitchen-display`, `npm run check:staff-table-detail`, and `npm run audit:structure` for small repeatable checks.

## Next Slices

1. Keep new feature work out of the near-threshold pages unless it goes through components/hooks first.
2. Split `src/styles/option-modal.css` if the option modal needs more visual states.
3. Keep page/component code free of direct Firestore/Auth SDK imports; add service functions first when new workflows are needed.
4. Continue splitting near-threshold CSS files (`option-modal`, `customer-menu`, admin product CSS) before adding more visual states.
