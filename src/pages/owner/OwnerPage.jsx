import { useEffect, useState } from 'react'
import OwnerAllowedEmailForm from '../../components/owner/OwnerAllowedEmailForm'
import OwnerAllowedEmailList from '../../components/owner/OwnerAllowedEmailList'
import OwnerHeader from '../../components/owner/OwnerHeader'
import { useAuth } from '../../contexts/AuthContext'
import { normalizeOwnerEmail, validateOwnerEmail } from '../../lib/ownerAccess'
import { signOutCurrentUser } from '../../services/authSessionService'
import {
  addOwnerAllowedEmail,
  removeOwnerAllowedEmail,
  subscribeOwnerAllowedEmails,
} from '../../services/ownerAccessService'

export default function OwnerPage() {
  const { user } = useAuth()
  const [allowed, setAllowed] = useState([])
  const [emailInput, setEmailInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => subscribeOwnerAllowedEmails(setAllowed), [])

  async function handleAdd(event) {
    event.preventDefault()
    const email = normalizeOwnerEmail(emailInput)
    const validationError = validateOwnerEmail(email)
    if (validationError) {
      setError(validationError)
      return
    }

    setAdding(true)
    setError('')
    try {
      await addOwnerAllowedEmail({ email, addedBy: user?.email ?? null })
      setEmailInput('')
    } catch {
      setError('追加に失敗しました')
    } finally {
      setAdding(false)
    }
  }

  function handleRemove(email) {
    removeOwnerAllowedEmail(email)
  }

  return (
    <div className="owner-page">
      <OwnerHeader onSignOut={signOutCurrentUser} />
      <main className="owner-content">
        <OwnerAllowedEmailForm
          adding={adding}
          emailInput={emailInput}
          error={error}
          onChange={value => {
            setEmailInput(value)
            setError('')
          }}
          onSubmit={handleAdd}
        />
        <OwnerAllowedEmailList
          allowedEmails={allowed}
          onRemove={handleRemove}
        />
      </main>
    </div>
  )
}
