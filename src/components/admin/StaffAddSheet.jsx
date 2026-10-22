import { useEffect, useState } from 'react'
import { NEW_STAFF_PERMISSION_PRESET } from '../../lib/staffPermissions'
import { normalizeStaffCode, validateStaffMemberForm } from '../../lib/staffMember'
import BottomSheet from '../ui/BottomSheet'
import StaffRoleCards from './StaffRoleCards'

// スタッフを追加（2026-10-23）。名前・4桁のパス・役割。最初の役割は通常スタッフ（ユーザー様の選択）。
export default function StaffAddSheet({ open, adding, error, onAdd, onClose }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [permissionPreset, setPermissionPreset] = useState(NEW_STAFF_PERMISSION_PRESET)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!open) return
    setName('')
    setCode('')
    setPermissionPreset(NEW_STAFF_PERMISSION_PRESET)
    setFormError('')
  }, [open])

  function handleSubmit(event) {
    event.preventDefault()
    const validationError = validateStaffMemberForm({ name, code })
    if (validationError) {
      setFormError(validationError)
      return
    }
    onAdd({ name, code, permissionPreset })
  }

  return (
    <BottomSheet open={open} title="スタッフを追加" onClose={onClose}>
      <form className="staff-sheet-form" onSubmit={handleSubmit}>
        <div className="staff-sheet-form__row">
          <label className="staff-sheet-form__field">
            <span>名前</span>
            <input value={name} onChange={event => { setName(event.target.value); setFormError('') }} placeholder="例：中村 翔" autoFocus />
          </label>
          <label className="staff-sheet-form__field staff-sheet-form__field--pin">
            <span>4桁のパス</span>
            <input
              value={code}
              onChange={event => { setCode(normalizeStaffCode(event.target.value)); setFormError('') }}
              inputMode="numeric"
              placeholder="0000"
            />
          </label>
        </div>
        <div className="staff-sheet-form__field">
          <span>役割（あとで変えられます）</span>
          <StaffRoleCards value={permissionPreset} onChange={setPermissionPreset} />
        </div>
        <p className="staff-sheet-form__note">パスは本人に伝えてください。スタッフは名前を選んで、このパスで入ります。</p>
        {(formError || error) && <p className="staff-sheet-form__error" role="alert">{formError || error}</p>}
        <button type="submit" disabled={adding} className="ui-button ui-button--primary ui-button--block">
          {adding ? '追加しています...' : '追加する'}
        </button>
      </form>
    </BottomSheet>
  )
}
