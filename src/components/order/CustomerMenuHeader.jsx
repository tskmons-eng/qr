import CustomerTopBar from './CustomerTopBar'

export default function CustomerMenuHeader({ tableName, onCall, callDisabled }) {
  return (
    <CustomerTopBar
      tableName={tableName}
      title="メニュー"
      onCall={onCall}
      callDisabled={callDisabled}
    />
  )
}
