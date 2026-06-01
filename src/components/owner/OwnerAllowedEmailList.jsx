import { formatAllowedEmailAddedAt } from '../../lib/ownerAccess'

export default function OwnerAllowedEmailList({ allowedEmails, onRemove }) {
  if (allowedEmails.length === 0) {
    return <p className="owner-email-list__empty">許可済みのメールアドレスはありません</p>
  }

  return (
    <div className="owner-email-list">
      {allowedEmails.map(entry => (
        <div key={entry.id} className="owner-email-card">
          <div className="owner-email-card__main">
            <div className="owner-email-card__address">{entry.email}</div>
            <div className="owner-email-card__date">
              追加日時: {formatAllowedEmailAddedAt(entry)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRemove(entry.email)}
            className="owner-email-card__remove"
          >
            削除
          </button>
        </div>
      ))}
    </div>
  )
}
