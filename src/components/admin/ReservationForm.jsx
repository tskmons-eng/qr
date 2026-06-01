export default function ReservationForm({ form, tables, saving, onFormChange, onSubmit }) {
  const canSubmit = form.name.trim()

  function updateField(key, value) {
    onFormChange(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="reservation-form">
      <div className="reservation-form__row">
        <label className="reservation-form__field">
          <span>日付</span>
          <input type="date" value={form.date} onChange={e => updateField('date', e.target.value)} />
        </label>
        <label className="reservation-form__field">
          <span>時間</span>
          <input type="time" value={form.time} onChange={e => updateField('time', e.target.value)} />
        </label>
      </div>

      <label className="reservation-form__field">
        <span>お名前 *</span>
        <input type="text" value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="山田 太郎" />
      </label>

      <div className="reservation-form__row">
        <label className="reservation-form__field">
          <span>人数</span>
          <input type="number" value={form.guestCount} min="1" onChange={e => updateField('guestCount', e.target.value)} />
        </label>
        <label className="reservation-form__field">
          <span>電話</span>
          <input type="tel" value={form.phone} onChange={e => updateField('phone', e.target.value)} />
        </label>
      </div>

      <label className="reservation-form__field">
        <span>席（任意）</span>
        <select value={form.tableId} onChange={e => updateField('tableId', e.target.value)}>
          <option value="">未指定</option>
          {tables.map(table => (
            <option key={table.id} value={table.id}>{table.tableName}</option>
          ))}
        </select>
      </label>

      <label className="reservation-form__field">
        <span>メモ</span>
        <input type="text" value={form.note} onChange={e => updateField('note', e.target.value)} placeholder="アレルギー・ご要望など" />
      </label>

      <button
        type="button"
        className="reservation-form__submit"
        disabled={saving || !canSubmit}
        onClick={onSubmit}
      >
        {saving ? '保存中...' : '登録する'}
      </button>
    </div>
  )
}
