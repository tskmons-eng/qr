import { useEffect, useState } from 'react'
import StaffMemberForm from '../../components/admin/StaffMemberForm'
import StaffMemberList from '../../components/admin/StaffMemberList'
import { useStore } from '../../contexts/StoreContext'
import { DEFAULT_STAFF_PERMISSION_PRESET, buildStaffPermissionsFromPreset } from '../../lib/staffPermissions'
import { normalizeStaffCode, validateStaffMemberForm } from '../../lib/staffMember'
import { createStaffMember, deleteStaffMember, loadStaffMembers, updateStaffMemberPermissions } from '../../services/staffAuthService'

export default function StaffPage() {
  const { storeId } = useStore()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [permissionPreset, setPermissionPreset] = useState(DEFAULT_STAFF_PERMISSION_PRESET)
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

  async function handlePermissionPresetChange(member, nextPreset) {
    if (nextPreset === 'legacy' || nextPreset === 'custom') return
    const permissions = buildStaffPermissionsFromPreset(nextPreset)
    await updateStaffMemberPermissions({
      memberId: member.id,
      permissionPreset: nextPreset,
      permissions,
    })
    setMembers(prev => prev.map(existing => (
      existing.id === member.id
        ? { ...existing, permissionPreset: nextPreset, permissions }
        : existing
    )))
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
        onDelete={handleDelete}
        onPermissionPresetChange={handlePermissionPresetChange}
      />
    </div>
  )
}
