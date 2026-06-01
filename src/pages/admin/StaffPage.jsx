import { useEffect, useState } from 'react'
import StaffMemberForm from '../../components/admin/StaffMemberForm'
import StaffMemberList from '../../components/admin/StaffMemberList'
import { useStore } from '../../contexts/StoreContext'
import { normalizeStaffCode, validateStaffMemberForm } from '../../lib/staffMember'
import { createStaffMember, deleteStaffMember, loadStaffMembers } from '../../services/staffAuthService'

export default function StaffPage() {
  const { storeId } = useStore()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
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
      await createStaffMember({ storeId, name, code })
      setName('')
      setCode('')
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

  return (
    <div className="admin-staff">
      <h2 className="admin-staff__heading">スタッフ管理</h2>
      <StaffMemberForm
        name={name}
        code={code}
        adding={adding}
        error={error}
        onNameChange={setName}
        onCodeChange={value => setCode(normalizeStaffCode(value))}
        onAdd={handleAdd}
      />
      <StaffMemberList
        loading={loading}
        members={members}
        onDelete={handleDelete}
      />
    </div>
  )
}
