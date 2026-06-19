# Customer Order UX Work Index

目的: お客様注文画面とキッチン表示の分かりにくさを、既存の注文処理やデータを壊さずに改善する。

## 絶対条件

- 既存の `orders`, `orderItems`, `checks`, `products`, `categories` を削除・移行しない。
- 既存UI導線を増やしすぎず、現在のメニュー、注文確認、キッチン画面へ自然に統合する。
- 見た目をあとから直す前提にせず、追加表示は最初から読みやすい場所へ整理する。
- 本番 deploy は統合確認後に行う。

## 分担MD

1. [01-sold-out-product-order.md](01-sold-out-product-order.md)
   - 品切れ/売り切れ商品をメニュー下部へ回す担当。

2. [02-customer-order-visibility.md](02-customer-order-visibility.md)
   - お客様の注文確認で、過去に頼んだ商品、準備中、提供済み、キャンセルを分かるようにする担当。

3. [03-kitchen-option-display.md](03-kitchen-option-display.md)
   - お客様が選んだタレ/塩などのオプションをキッチンパネルへ表示する担当。

## 現在のUI方針

- ユーザー様は、注文できない商品が上に残って通常商品の注文を邪魔する状態を避けたい。
- ユーザー様は、お客様自身が「何が注文済みで、何がまだ注文できていないか」を確認できることを重視している。
- ユーザー様は、キッチンが味付けなどの注文オプションを見落とさないことを重視している。

## 2026-06-19 現在の到達点

- 03では、キッチンの商品行に `optionSelections` を表示する対応を追加済み。
- `npm run check:kitchen-display`, `npm run check:staff-table-detail`, `npm run check`, `npm run build` は通過済み。
- 本番 deploy は未実施。
