# 04 Admin Category iOS Zoom Guard

## Purpose

カテゴリー管理画面で既存カテゴリーの編集ボタンを押した時、iOS Safari で画面がズームされる挙動を抑制する。

## Current Confirmation

- カテゴリー管理は `src/components/admin/CategoryManager.jsx` と `src/components/admin/CategoryRow.jsx`。
- 編集時は `CategoryEditRow` の `input` に `autoFocus` が付いている。
- iOS Safari は `font-size` が16px未満の input/select へフォーカスすると自動ズームしやすい。

## Change Plan

- カテゴリー編集でフォーカスされる input/select/button 周辺の `font-size` を16px以上にする。
- 必要なら `autoFocus` をiOSだけ遅延/抑制する小さな設計にするが、まずCSSで解決する。
- カテゴリー行の高さや操作ボタンが過度に大きくならないよう、font-size と padding を分けて調整する。
- 他の管理画面入力にも同じ問題がある場合は、共通 admin input class に限定して最小範囲で直す。

## Forbidden Changes

- カテゴリーの追加/編集/削除/並び替えロジックを変えない。
- `categories` や `products.displayCategoryIds` のデータ処理を変えない。
- viewport の `user-scalable=no` のような全体ズーム禁止に逃げない。

## Impact Scope

- `src/components/admin/CategoryRow.jsx` only if autofocus handling is required
- `src/styles/admin-product-category.css`
- `src/styles/admin-shared.css` only if common input fix is needed
- `scripts/check-admin-category.mjs`
- this MD

## Verification

- `npm run check:admin-category`
- `npm run check:product-form`
- `npm run check`
- `npm run build`
- 可能ならiPhone相当のモバイル viewport でカテゴリー編集を確認する。

## Completion Notes

- Production deploy: not run in this task.
- Result:
- Checks:
- Remaining risk:

