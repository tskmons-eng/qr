# 01 Sold-out Product Order

## 目的

品切れ/売り切れの商品を、お客様メニューとスタッフ注文メニューの各分類内で一番下に表示する。

## 実装状況

- 担当: Codex
- 状態: 実装済み
- 実装日: 2026-06-19

## 現状確認

- 商品は `loadCustomerMenuData` で `sortOrder` 順に取得される。
- お客様メニューは `src/pages/order/MenuPage.jsx` で分類フィルタ後の商品を表示している。
- スタッフ注文メニューは `src/pages/staff/StaffMenuPage.jsx` で同じ商品データを表示している。
- 売り切れ商品は `product.isSoldOut` でボタン無効・売り切れ表示になっているが、表示位置は通常商品と同じ `sortOrder` のまま。

## 変更方針

- `sortOrder` やFirestoreデータは変更しない。
- 表示直前の配列だけを並べ替え、通常商品の既存順と売り切れ商品の既存順は維持する。
- お客様メニューとスタッフ注文メニューで同じ helper を使う。

## 影響範囲

- `src/lib/menuProductOrder.js`
- `src/pages/order/MenuPage.jsx`
- `src/pages/staff/StaffMenuPage.jsx`
- `scripts/check-menu-product-order.mjs`

## 検証方法

- `npm run check:menu-product-order`
- `npm run check:customer-entry`
- `npm run check:staff-menu`
- `npm run check`
- `npm run build`
