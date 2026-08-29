import CustomerTopBar from './CustomerTopBar'

export default function OrderStatusHeader({ tableName, checkoutStep, onCall, callDisabled, loading }) {
  const title = checkoutStep === 'sent'
    ? '会計依頼済み'
    : checkoutStep === 'confirming'
      ? '会計確認'
      : '注文履歴'

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
