# 03 Kitchen Option Display

## 目的

お客様がタレ/塩などのオプションを選択したとき、キッチンパネルにも味付けが表示されるようにする。

## 現状確認

- 注文明細には `optionSelections` が保存される。
- スタッフ席詳細では `formatTableOrderOptions` を使ってオプション表示がある。
- キッチン行 `KitchenItemRow` は商品名、数量、注文者、経過時間だけを表示し、`optionSelections` を出していない。

## 変更方針

- `optionSelections` の表示用 formatter を共有化するか、既存 helper を無理なく再利用する。
- キッチンの各商品行で、商品名の下またはメタ情報の近くに味付けを短く表示する。
- タレ/塩以外のオプションにも対応し、長い選択肢でもレイアウトが崩れないようにする。

## 影響範囲

- `src/components/staff/KitchenItemRow.jsx`
- `src/lib/kitchenDisplay.js` または共有 formatter
- `src/styles/staff-kitchen.css`
- `scripts/check-kitchen-display.mjs`

## 検証方法

- `npm run check:kitchen-display`
- `npm run check:staff-table-detail`
- `npm run check`
- `npm run build`

## 2026-06-19 実装メモ

追加:

- `src/lib/kitchenDisplay.js`
  - `formatKitchenOrderOptions` を追加し、`groupName` がある場合は `タレ: 塩` のようにキッチンで意味が分かる表示へ整形。
  - 不正または空の option は表示しない。
- `src/components/staff/KitchenItemRow.jsx`
  - 商品名/数量の下に、選択オプションを1行追加。
  - 既存のキッチンカード、提供済み、削除導線は変更しない。
- `src/styles/staff-kitchen-table.css`
  - 長い選択肢が行幅や操作ボタンを押し広げないよう、option 表示を折り返し可能にした。
- `scripts/check-kitchen-display.mjs`
  - formatter、KitchenItemRow の接続、CSS の折り返し設定を検証。

検証結果:

- `npm run check:kitchen-display` passed.
- `npm run check:staff-table-detail` passed.
- `npm run check` passed.
- `npm run build` passed.

本番 deploy はこの分担では実行しない。
