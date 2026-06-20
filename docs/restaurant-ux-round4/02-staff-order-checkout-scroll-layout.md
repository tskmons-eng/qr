# 02 Staff Order And Checkout Scroll Layout

## Purpose

スタッフ側の注文追加画面で、提供済みや注文リストが長くても下部の注文追加メニューや送信ボタンまで長距離ドラッグしなくてよいレイアウトにする。
会計画面でも商品が多い時に、明細部分だけをスクロールし、会計確定などの操作は押しやすい位置に残す。

## Current Confirmation

- スタッフ注文追加は `src/pages/staff/StaffMenuPage.jsx`、商品リストは `src/components/staff/StaffMenuProductList.jsx`、送信バーは `src/components/staff/StaffMenuSubmitBar.jsx`。
- スタッフ席詳細の提供済み/準備中リストは `src/components/staff/TableDetailOrderContent.jsx`、`TableOrderSection.jsx`。
- 会計画面は `src/pages/staff/CheckoutPage.jsx` と `src/components/staff/Checkout*` コンポーネント。
- スタッフ下部ナビは `src/components/StaffBottomNav.jsx` と `src/styles/bottom-nav.css`。

## Change Plan

- スタッフ注文追加画面は、カテゴリ/商品リストを内容領域としてスクロールさせ、送信バーは下部に固定または sticky 表示にする。
- 提供済みリストは縦に長く積むだけではなく、折り返し/コンパクト行で一覧性を上げる。
- 会計画面は、明細リスト部分を独立スクロールにし、人数/割引/支払い/確定操作の位置が崩れないようにする。
- bottom nav と submit/confirm bar が重ならないよう、`padding-bottom` と safe-area を明示する。
- モバイル幅でテキストがボタンからはみ出さないようにする。

## UI Requirements

- 「下のメニューが最初から見える」ことを優先する。
- 内容はスクロールできるが、主要操作は見失わない。
- floating/sticky 風にしてよいが、カードの中にカードを重ねる見た目にしない。
- 文字サイズを無理に小さくしない。余白、grid、折り返しで調整する。

## Forbidden Changes

- 注文送信、会計確定、割引計算、履歴作成のロジックを変えない。
- `orders`, `orderItems`, `checks` のデータ構造を変えない。
- 下部ナビの既存ルートを変えない。

## Impact Scope

- `src/pages/staff/StaffMenuPage.jsx`
- `src/components/staff/StaffMenuProductList.jsx`
- `src/components/staff/StaffMenuSubmitBar.jsx`
- `src/components/staff/TableDetailOrderContent.jsx`
- `src/components/staff/TableOrderSection.jsx`
- `src/pages/staff/CheckoutPage.jsx`
- `src/components/staff/CheckoutItemDiscountList.jsx`
- `src/components/staff/CheckoutConfirmBar.jsx`
- `src/styles/staff-menu.css`
- `src/styles/staff-table-orders.css`
- `src/styles/staff-checkout-layout.css`
- `src/styles/staff-checkout-payment.css`
- `src/styles/bottom-nav.css`
- this MD

## Verification

- `npm run check:staff-menu`
- `npm run check:staff-table-detail`
- `npm run check:checkout`
- `npm run check:order-command-ui`
- `npm run check`
- `npm run build`

## Completion Notes

- Production deploy: not run in this task.
- Result: スタッフ注文追加はカテゴリ/商品を独立スクロール領域にし、送信バーを下部ナビ上の固定位置へ整理した。会計は注文明細だけを高さ制限付きスクロールにし、支払い入力と会計確定バーを見失いにくい配置にした。席詳細の提供済み/注文行は折り返し可能なコンパクト行へ調整した。
- Checks: `git diff --check`, `npm run check:staff-menu`, `npm run check:staff-table-detail`, `npm run check:checkout`, `npm run check:order-command-ui`, `npm run check`, `npm run build` passed.
- Remaining risk: 実データでのモバイル実機スクロール感は未確認。Firebase Production deploy は統合ゲートまで未実施。

## 2026-06-20 Live Feedback Adjustment

- Finding: The live feedback said the scroll behavior still did not feel changed enough.
- Fix: Made the staff table detail page a viewport-height shell with only the order/seating content scrolling internally, while the bottom action area remains reachable. Checkout now separates the item-list scroll area from the payment/confirmation scroll area so long lists do not push the final action out of reach.
- Data impact: Layout/CSS only for staff table detail and checkout. No order, checkout, menu, history, rules, indexes, storage, or Functions data changes.
- Verification target: `npm run check:staff-table-detail`, `npm run check:checkout`, `npm run check:staff-menu`, `npm run check`, `npm run build`, and final release gate.

## 2026-06-20 Order Menu Scroll Hardening

- Finding: The order-add screen still depended on fragile viewport sizing around fixed bars, so some devices did not behave like a proper internal scroll surface.
- Fix: Hardened the staff order-add shell with viewport max-height, mobile momentum scrolling, and explicit vertical touch handling for the product list.
- Data impact: Staff order-add UI/CSS only. Order submission, menu data, order history, QR URLs, rules, indexes, storage, and Functions are unchanged.
- Verification target: `npm run check:staff-menu`, `npm run check`, `npm run build`, and Hosting-only deploy verification.
