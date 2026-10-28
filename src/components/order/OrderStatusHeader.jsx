import CustomerTopBar from './CustomerTopBar'

export default function OrderStatusHeader({ tableName, checkoutStep, onCall, callDisabled, loading }) {
  // 2026-10-28 注文の流れ 第2章：注文履歴とお会計を1つの画面に。お会計の依頼は1回押すだけ。
  const title = checkoutStep === 'sent' ? 'お会計を依頼しました' : '注文履歴・お会計'

  return (
    <CustomerTopBar
      tableName={tableName}
      title={title}
      onCall={onCall}
      callDisabled={callDisabled}
      statusText={checkoutStep === 'sent' ? 'スタッフが向かいます' : loading ? '更新中' : ''}
    />
  )
}
