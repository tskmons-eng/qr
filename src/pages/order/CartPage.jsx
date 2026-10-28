import { Navigate, useLocation } from 'react-router-dom'

// カートは 2026-10-28（注文の流れ 第2章）からメニューの上のシート（CartSheet）になった。
// 以前の「/cart」へ来たときは、メニューへ移ってカートのシートを開く（知らせがあれば引き継ぐ）。
export default function CartPage() {
  const location = useLocation()
  return <Navigate to="../menu" replace state={{ openCart: true, submitNotice: location.state?.submitNotice ?? '' }} />
}
