import { useState } from 'react'
import { cleanOptionGroups } from '../lib/productForm'

export default function useProductOptionForm({ setForm }) {
  const [newChoiceInputs, setNewChoiceInputs] = useState([])

  function toggleOptionsEnabled(val) {
    if (!val) {
      setForm(form => ({ ...form, optionsEnabled: false, options: [] }))
      setNewChoiceInputs([])
      return
    }

    setForm(form => ({ ...form, optionsEnabled: true }))
  }

  function addOptionGroup() {
    setForm(form => ({
      ...form,
      options: [...form.options, { groupName: '', required: true, choices: [] }],
    }))
    setNewChoiceInputs(prev => [...prev, { label: '', extraPrice: '' }])
  }

  function removeOptionGroup(idx) {
    setForm(form => ({ ...form, options: form.options.filter((_, index) => index !== idx) }))
    setNewChoiceInputs(prev => prev.filter((_, index) => index !== idx))
  }

  function addChoice(idx) {
    const input = newChoiceInputs[idx] ?? { label: '', extraPrice: '' }
    const label = input.label.trim()
    if (!label) return

    const extraPrice = Math.max(0, parseInt(input.extraPrice, 10) || 0)
    setForm(form => {
      const options = [...form.options]
      options[idx] = {
        ...options[idx],
        choices: [...(options[idx].choices ?? []), { label, extraPrice }],
      }
      return { ...form, options }
    })
    setNewChoiceInputs(prev => {
      const next = [...prev]
      next[idx] = { label: '', extraPrice: '' }
      return next
    })
  }

  function removeChoice(groupIdx, choiceIdx) {
    setForm(form => {
      const options = [...form.options]
      options[groupIdx] = {
        ...options[groupIdx],
        choices: options[groupIdx].choices.filter((_, index) => index !== choiceIdx),
      }
      return { ...form, options }
    })
  }

  function updateOptionGroup(idx, patch) {
    setForm(form => {
      const options = [...form.options]
      options[idx] = { ...options[idx], ...patch }
      return { ...form, options }
    })
  }

  function updateNewChoiceInput(idx, patch) {
    setNewChoiceInputs(prev => {
      const next = [...prev]
      next[idx] = { ...(next[idx] ?? {}), ...patch }
      return next
    })
  }

  function applyOptionPreset(presetOptions) {
    const options = cleanOptionGroups(presetOptions)
    setForm(form => ({ ...form, optionsEnabled: true, options }))
    setNewChoiceInputs(options.map(() => ({ label: '', extraPrice: '' })))
  }

  return {
    newChoiceInputs,
    setNewChoiceInputs,
    toggleOptionsEnabled,
    addOptionGroup,
    removeOptionGroup,
    addChoice,
    removeChoice,
    updateOptionGroup,
    updateNewChoiceInput,
    applyOptionPreset,
  }
}
