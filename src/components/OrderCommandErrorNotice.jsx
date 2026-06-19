export default function OrderCommandErrorNotice({ message, className = '' }) {
  if (!message) return null

  const classes = ['order-command-error-notice', className].filter(Boolean).join(' ')

  return (
    <div className={classes} role="alert">
      <span>{message}</span>
    </div>
  )
}
