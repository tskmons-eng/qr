import assert from 'node:assert/strict'
import {
  buildMultiQuantityOptionItems,
  buildOptionSelections,
  calculateChoiceQuantityTotal,
  calculateMultiQuantityTotal,
  calculateOptionExtraTotal,
  canConfirmOptionModal,
  normalizeChoiceQuantity,
  normalizeOptionChoice,
  normalizeQuantity,
} from '../src/lib/optionModal.js'

assert.deepEqual(normalizeOptionChoice('Small'), { label: 'Small', extraPrice: 0 })
assert.deepEqual(normalizeOptionChoice({ label: 'Large', extraPrice: 150, code: 'L' }), {
  label: 'Large',
  extraPrice: 150,
  code: 'L',
})

assert.equal(normalizeQuantity('0'), 1)
assert.equal(normalizeQuantity('42'), 42)
assert.equal(normalizeQuantity('100'), 99)
assert.equal(normalizeQuantity('abc'), 1)
assert.equal(normalizeChoiceQuantity('-1'), 0)
assert.equal(normalizeChoiceQuantity('12'), 12)
assert.equal(normalizeChoiceQuantity('120'), 99)

const singleOptions = [
  { groupName: 'Size', required: true },
  { groupName: 'Sauce', required: false },
]
const selections = {
  Size: { label: 'Large', extraPrice: 150 },
  Sauce: { label: 'Spicy', extraPrice: 50 },
}

assert.equal(calculateOptionExtraTotal(selections), 200)
assert.deepEqual(buildOptionSelections(singleOptions, selections), [
  { groupName: 'Size', choice: 'Large', extraPrice: 150 },
  { groupName: 'Sauce', choice: 'Spicy', extraPrice: 50 },
])
assert.equal(canConfirmOptionModal({
  options: singleOptions,
  selections: { Size: selections.Size },
  choiceQuantities: {},
  multiQuantityMode: false,
}), true)
assert.equal(canConfirmOptionModal({
  options: singleOptions,
  selections: {},
  choiceQuantities: {},
  multiQuantityMode: false,
}), false)

const multiGroup = {
  groupName: 'Topping',
  choices: [
    { label: 'Cheese', extraPrice: 100 },
    { label: 'Egg', extraPrice: 80 },
  ],
}
const choiceQuantities = { Cheese: 2, Egg: 0 }

assert.equal(calculateChoiceQuantityTotal(choiceQuantities), 2)
assert.equal(calculateMultiQuantityTotal(multiGroup, choiceQuantities, 900), 2000)
assert.deepEqual(buildMultiQuantityOptionItems(multiGroup, choiceQuantities), [
  {
    optionSelections: [{ groupName: 'Topping', choice: 'Cheese', extraPrice: 100 }],
    quantity: 2,
  },
])
assert.equal(canConfirmOptionModal({
  options: [multiGroup],
  selections: {},
  choiceQuantities,
  multiQuantityMode: true,
}), true)
assert.equal(canConfirmOptionModal({
  options: [multiGroup],
  selections: {},
  choiceQuantities: {},
  multiQuantityMode: true,
}), false)

console.log('option modal checks passed')
