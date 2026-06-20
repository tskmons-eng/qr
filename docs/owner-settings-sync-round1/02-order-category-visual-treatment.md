# 02 Order Category Visual Treatment

## Purpose

注文パネルやカテゴリ表示で、各項目に `ドリンク` / `フード` と文字を付けるのではなく、枠色・左ライン・小さな点などの省スペースな表現で見分けられるようにする。

## Current Confirmation

- `src/components/order/CustomerCategoryTabs.jsx` は `CATEGORY_GROUP_LABELS` で `ドリンク` / `フード` の文字バッジをカテゴリごとに表示している。
- `src/styles/customer-menu.css` には `customer-category-tabs__group--drink` と `customer-category-tabs__group--food` のスタイルがある。
- `scripts/check-customer-cart.mjs` は現在、カテゴリタブに `ドリンク` / `フード` の文字ラベルがあることを検査している。
- スタッフ席詳細の注文行 `src/components/staff/TableOrderSection.jsx` は、フード/ドリンクを絵文字バッジで表示している。
- キッチンフィルタ `src/lib/kitchenDisplay.js` は `🥤 ドリンク` / `🍽 フード` をフィルタ名として持つ。

## Change Plan

- まず対象画面を確認し、ユーザー様が見ている「注文パネル」が顧客カテゴリタブ、スタッフ席詳細、キッチンのどれかを実画面で特定する。
- 顧客カテゴリタブでは、カテゴリ名を主役にし、`ドリンク` / `フード` の可視テキストバッジは外す。代わりに category group ごとの枠色、左ライン、背景のごく薄い差で見分ける。
- アクセシビリティ上の説明が必要な場合は、画面上に常時文字を増やさず `aria-label` や `title` を使う。
- スタッフ注文行やキッチンフィルタを触る場合も、操作対象の意味が分からなくならない範囲で文字量を減らす。フィルタボタンのように選択肢名そのものが必要な箇所は残してよい。
- チェックスクリプトは「文字ラベルがあること」ではなく、「group別の視覚クラスがあること」を検査する。

## UI Requirements

- カテゴリ名や商品名より、`ドリンク` / `フード` の補助情報が目立たないようにする。
- 色だけに依存しすぎず、枠線や位置でも差を出す。
- ボタン高さや横幅を無駄に増やさない。
- 追加した機能を全部表に出す必要はない、というユーザー様のUI方針を優先する。

## Impact Scope

- `src/components/order/CustomerCategoryTabs.jsx`
- `src/styles/customer-menu.css`
- `scripts/check-customer-cart.mjs`
- `src/components/staff/TableOrderSection.jsx` only if the confirmed surface is staff order detail
- `src/styles/staff-table-orders.css` only if the confirmed surface is staff order detail
- `src/lib/kitchenDisplay.js` and kitchen styles only if the confirmed surface is kitchen filter
- this MD

## Forbidden Changes

- `categories.group` や商品データの構造を変えない。
- 注文送信、カート、会計、キッチン提供済み処理を変えない。
- フード/ドリンクの判定をCSSだけで推測しない。既存の `category.group` / `categoryGroup` を使う。

## Verification

- `npm run check:customer-cart`
- `npm run check:staff-table-detail` if staff order detail is changed
- `npm run check:kitchen-display` if kitchen filter is changed
- `npm run check`
- `npm run build`

## Completion Notes

- Production deploy: not run in this task.
- Result:
- Checks:
- Remaining risk:
