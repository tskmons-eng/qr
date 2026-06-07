# QR System Maintenance Plan

## User Priority

The application is already in use, so refactoring must not change production behavior accidentally. The priority is to reduce file bloat, separate CSS and driving logic, and make future bug checks and feature additions easier without disrupting current users.

Typography should use `M PLUS Rounded 1c` as the main font for a rounded, strong Gothic admin feel. Body text should stay slightly heavy, labels and buttons should be bold, and totals or important numeric values should use weight 900 with tabular numbers. Fallbacks are `Noto Sans JP`, `Yu Gothic UI`, `Meiryo`, `system-ui`, and sans-serif.

Checkout payment controls should prioritize staff speed at the register. The received-cash presets need an exact-total button before fixed bills such as 1000, 5000, and 10000 yen, and duplicate amounts should be avoided when the exact total matches a fixed preset.

Owner-level trial management must not affect active stores. Add read-only oversight under `/owner` only, keep `/admin`, `/staff`, `/order/:qrToken`, `StoreContext`, and Firestore rules unchanged for the first slice, and do not add write controls such as store switching, pausing, or proxy admin access until the read-only dashboard is proven safe.

Allowed-email management is security-sensitive. Only the fixed super-admin account may list, add, or remove Google admin access emails; normal allowed managers should not load or mutate the shared `allowedEmails` collection.

Store administrator email changes must not migrate live store IDs. The safe model is an owner-only `storeAdminEmails/{email}` assignment that points a Google account to an existing `storeId`, while legacy `stores/{uid}` ownership continues to work.

Staff capability management must preserve existing active stores. Missing staff permission fields are treated as legacy floor access for current staff workflows, while new elevated actions such as menu management and register closing require explicit permission toggles.

## 2026-06-08 Active Store Feature Plan

この計画は、すでに利用中の店舗へ支障を出さないことを最優先にする。既存データに新しい設定値がない場合は、必ず現状と同じ動きにフォールバックする。実装は一括で混ぜず、各スライスごとに `src/lib`, `src/services`, `src/components`, `src/styles` の既存分割に沿って進める。

### Safety Rules

1. 新機能の設定は既定値で既存挙動を維持する。特に自動追加、提供済み管理の非表示、通知設定、席グループは既存店舗を壊さない。
2. 権限の高い管理者だけが触る設定は、既存の owner/admin/staff permission model を確認してから UI と Firestore write を追加する。
3. QR URL は、席名変更、人数変更、グループ変更、表示順変更では絶対に再発行しない。QR再発行ボタンだけを明示的な URL 変更経路にする。
4. スマホ UI 改善は表示密度と押しやすさを改善する範囲に留め、注文、会計、呼び出し、キッチンなどの導線は既存ルートを保つ。
5. それぞれのスライスで `npm run check` 系の該当チェック、`npm run build`、主要ルートの手動確認を行ってから deploy/push する。

### Slice 1: 現状調査と既存不具合の先行修正

1. スタッフパスが使えなくなった原因を、スタッフ作成、スタッフ選択、staff session、保存済み店舗コード、Firestore rules の順で確認する。
2. スタッフ選択画面に「スタッフ追加」導線がない問題を確認し、権限のある人だけが追加できる場所へ自然に戻せる UI にする。
3. 席詳細の「席に戻る」「戻る」ボタンがホームや席一覧へ戻れない問題を、ルート定義と `StaffBottomNav` の遷移先から修正する。
4. 注文後の席詳細で人数変更が削除以外にできない問題を確認し、既存の `updateTableGuestCount` 系の処理を再利用して席詳細と会計画面から変更できるようにする。
5. ここは他機能より先に直す。現在使っているスタッフ操作に直結するため、デザイン変更や設定追加と混ぜない。

### Slice 2: スマホ向けスタッフ/客側ナビゲーション整理

1. 上部メニューはスマホで横詰まりしない compact toolbar にする。重要操作だけを見せ、補助操作は設定やメニュー内へ寄せる。
2. 下部ナビは高さ、余白、文字サイズ、アイコンサイズを抑え、全ボタンが同じ密度で並ぶようにする。
3. 客側の下部ナビは「注文」「注文確認」「呼び出し」「会計」の順に整理する。
4. 客側では「カート」という表示を、注文追加の意味が伝わる「追加」に変更する。
5. ご注文情報内で呼び出しボタンと会計ボタンが重複している箇所を整理し、同じ操作が同時に複数表示されないようにする。
6. 通知オン/オフはヘッダーではなく設定内の一つのボタンまたはトグルに集約する。

### Slice 3: 通知とログアウト/PWA挙動の整理

1. 現在の通知登録、`staffTokens`、localStorage、service worker、PWA ホーム追加時の挙動を調査する。
2. ログアウト時は active staff/store 情報を消すだけでなく、可能なら通知トークンを無効化または店舗通知対象から外す。
3. 店休日や休みの日に通知が来る不安を減らすため、店舗設定側の通知オン/オフを保存し、購読処理や通知送信側で参照する。
4. ホーム画面に追加された PWA でも、ログアウト済み端末が新規通知を受け続けないことを検証項目に入れる。

### Slice 4: 高権限設定と人数連動メニュー自動追加

1. 権限の高い人だけが設定できる store setting を追加する。
2. 人数入力時に自動追加するメニューを選べる設定を作る。保存値は product id と表示名のどちらが安全か、削除済み商品へのフォールバック込みで設計する。
3. 人数設定画面に「人数分メニューを追加」ボタンを表示するかどうかのチェック項目を設定に追加する。
4. 自動追加は既定でオフにし、既存店舗の人数入力や注文導線には影響を出さない。
5. 同じ席で人数変更を繰り返した場合に、重複追加、減員時の削除、既存注文との区別をどう扱うかを仕様化してから実装する。

### Slice 5: 席グループ自由タブ

1. 管理側で「すべて」「1階」「2階」「カウンター」などの席グループを自由に作成、名称変更、削除、並び替えできるようにする。
2. 各席に group id を持たせ、未設定の既存席は「すべて」に必ず表示する。
3. スタッフ席一覧では上部メニューの下にグループタブを表示し、タブで席を絞り込む。
4. グループ削除時は席を未設定に戻すか、別グループへ移す導線を用意し、席自体や注文は消さない。
5. キッチン側で使っているテーブルごとの表示ロジックとは混同せず、席一覧用の設定として追加する。

### Slice 6: 提供済み機能の店舗別オン/オフ

1. 「提供済み」機能が不要な店舗向けに、設定でオン/オフできるようにする。
2. オフにした場合は、キッチンや関連画面で提供済み操作と提供経過の「何分」表示が出なくなることを注意書きで明示する。
3. 既定値はオンにして、現在使っている店舗のキッチン運用を変えない。
4. 表示を消すだけでなく、誤って提供済み更新を書き込まないようサービス側も設定を参照する。

### Slice 7: メニュー削除と権限整理

1. メニュー削除時のパスワード要求は、権限の高い管理者には不要にする。
2. 低い権限のスタッフや通常操作では、現行の安全確認を残す。
3. メニュー作成、期間限定メニュー作成、キッチン、レジ締め、自分と同等の権限付与、下位権限付与の範囲をスタッフ権限表示に整理する。
4. ヒントマークで、それぞれの権限がどこまでできるかを確認できる説明を出す。

### Slice 8: 客側/スタッフ側の注文完了体験

1. 客側で注文送信後に「ありがとうございます！」の完了画面を表示し、ボタンで注文画面または注文確認へ戻れるようにする。
2. スタッフ側で追加注文送信後も「注文完了！」の完了状態を出し、注文できたか分かるようにする。
3. スタッフ会計完了画面の既存パターンを参考にし、過剰な新規 UI を作らない。
4. 追加注文許可設定がある場合は、既存の `allowAdditionalOrders` と競合しないようにする。

### Slice 9: QR URL安定化

1. 現在の QR URL 生成、table `qrToken`、QR再発行処理、PDF出力、公開URLの組み立てを確認する。
2. 席編集や deploy によって URL が変わる経路がないか調査する。
3. 同じ席は同じ URL を使い続ける設計にし、変更が必要な場合だけ「QR再発行」を押す運用に統一する。
4. 席名変更、人数変更、グループ変更の前後で QR URL が変わらないチェックを追加する。

### Delivery Order

1. 先に Slice 1 のスタッフログイン、戻るボタン、人数変更、スタッフ追加導線を直す。
2. 次に Slice 2 と Slice 3 でスマホ UI と通知の不安を解消する。
3. その後 Slice 4 から Slice 7 の設定/権限/店舗別機能を追加する。
4. Slice 8 の注文完了画面を入れ、最後に Slice 9 の QR URL 安定化を検証する。
5. 各スライスは個別に commit/push/deploy し、まとめて大きく壊れる変更にしない。

## Owner Dashboard Safety Plan

1. Reuse this maintenance plan instead of adding another planning MD.
2. Keep the first implementation read-only and scoped to `tsk.mons@gmail.com` through the existing `/owner` route guard.
3. Load owner-wide store, order, and checkout summaries through new owner-specific service/helper modules.
4. Show store list, today's sales, completed check count, open order count, and last activity without mutating store data.
5. Keep existing allowed-email management available as a separate owner tab.
6. Verify with `npm run check`, `npm run build`, and public deploy checks before considering any future write actions.

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
