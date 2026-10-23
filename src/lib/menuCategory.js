// 商品がその分類に出るか（2026-10-23 商品設計）。商品の分類（categoryId）だけで決める。
// 追加表示の分類・自動タグは本番で使われていなかったので無くした（ユーザー様の選択）。
export function productMatchesCategory(product, category) {
  return Boolean(category) && product.categoryId === category.id
}
