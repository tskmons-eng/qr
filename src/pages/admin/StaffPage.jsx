import { useEffect, useState } from 'react'
import StaffMemberForm from '../../components/admin/StaffMemberForm'
import StaffMemberList from '../../components/admin/StaffMemberList'
import { useStore } from '../../contexts/StoreContext'
import {
  DEFAULT_STAFF_PERMISSION_PRESET,
  buildStaffPermissionsFromPreset,
  getStaffPresetKeyFromPermissions,
  normalizeStaffMemberPermissions,
  setStaffPermissionValue,
} from '../../lib/staffPermissions'
import { normalizeStaffCode, validateStaffMemberForm } from '../../lib/staffMember'
import { createStaffMember, deleteStaffMember, loadStaffMembers, updateStaffMemberCode, updateStaffMemberPermissions } from '../../services/staffAuthService'

export default function StaffPage() {
  const { storeId } = useStore()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [permissionPreset, setPermissionPreset] = useState(DEFAULT_STAFF_PERMISSION_PRESET)
  const [resettingMemberId, setResettingMemberId] = useState(null)
  const [resetCode, setResetCode] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const nextMembers = await loadStaffMembers(storeId)
    setMembers(nextMembers)
    setLoading(false)
  }

  useEffect(() => {
    if (storeId) load()
  }, [storeId])

  async function handleAdd() {
    setError('')
    const validationError = validateStaffMemberForm({ name, code })
    if (validationError) {
      setError(validationError)
      return
    }

    setAdding(true)
    try {
      await createStaffMember({ storeId, name, code, permissionPreset })
      setName('')
      setCode('')
      setPermissionPreset(DEFAULT_STAFF_PERMISSION_PRESET)
      await load()
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('このスタッフを削除しますか？')) return
    await deleteStaffMember(id)
    setMembers(prev => prev.filter(member => member.id !== id))
  }

  async function saveMemberPermissions(member, permissionPreset, permissions) {
    await updateStaffMemberPermissions({
      memberId: member.id,
      permissionPreset,
      permissions,
    })
    setMembers(prev => prev.map(existing => (
      existing.id === member.id
        ? { ...existing, permissionPreset, permissions }
        : existing
    )))
  }

  async function handlePermissionPresetChange(member, nextPreset) {
    if (nextPreset === 'legacy' || nextPreset === 'custom') return
    const permissions = buildStaffPermissionsFromPreset(nextPreset)
    await saveMemberPermissions(member, nextPreset, permissions)
  }

  async function handlePermissionToggle(member, key, enabled) {
    const currentPermissions = normalizeStaffMemberPermissions(member)
    const permissions = setStaffPermissionValue(currentPermissions, key, enabled)
    const nextPreset = getStaffPresetKeyFromPermissions(permissions)
    await saveMemberPermissions(member, nextPreset, permissions)
  }

  function startCodeReset(member) {
    setResettingMemberId(member.id)
    setResetCode('')
    setError('')
  }

  function cancelCodeReset() {
    setResettingMemberId(null)
    setResetCode('')
  }

  async function handleCodeReset(member) {
    const normalized = normalizeStaffCode(resetCode)
    if (!/^\d{4}$/.test(normalized)) {
      setError('新しいコードは4桁の数字にしてください')
      return
    }
    await updateStaffMemberCode({ memberId: member.id, code: normalized })
    setMembers(prev => prev.map(existing => (
      existing.id === member.id ? { ...existing, code: normalized } : existing
    )))
    cancelCodeReset()
  }

  return (
    <div className="admin-staff">
      <h2 className="admin-staff__heading">スタッフ管理</h2>
      <StaffMemberForm
        name={name}
        code={code}
        permissionPreset={permissionPreset}
        adding={adding}
        error={error}
        onNameChange={setName}
        onCodeChange={value => setCode(normalizeStaffCode(value))}
        onPermissionPresetChange={setPermissionPreset}
        onAdd={handleAdd}
      />
      <StaffMemberList
        loading={loading}
        members={members}
        resettingMemberId={resettingMemberId}
        resetCode={resetCode}
        onDelete={handleDelete}
        onPermissionPresetChange={handlePermissionPresetChange}
        onPermissionToggle={handlePermissionToggle}
        onResetCodeChange={value => setResetCode(normalizeStaffCode(value))}
        onStartCodeReset={startCodeReset}
        onCancelCodeReset={cancelCodeReset}
        onSaveCodeReset={handleCodeReset}
      />
    </div>
  )
}
