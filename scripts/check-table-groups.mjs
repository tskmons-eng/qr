import assert from 'node:assert/strict'
import {
  ALL_TABLE_GROUP,
  buildTableGroupTabs,
  filterTablesByGroup,
  normalizeTableGroupName,
  sortTableGroups,
} from '../src/lib/tableGroups.js'

assert.equal(normalizeTableGroupName('  1階  '), '1階')

const groups = sortTableGroups([
  { id: 'counter', name: 'カウンター', sortOrder: 2 },
  { id: 'floor1', name: '1階', sortOrder: 1 },
])

assert.deepEqual(groups.map(group => group.id), ['floor1', 'counter'])
assert.deepEqual(buildTableGroupTabs(groups).map(group => group.id), [ALL_TABLE_GROUP.id, 'floor1', 'counter'])

const tables = [
  { id: 'a', groupId: 'floor1' },
  { id: 'b', groupId: 'counter' },
  { id: 'c', groupId: null },
]

assert.deepEqual(filterTablesByGroup(tables, 'all').map(table => table.id), ['a', 'b', 'c'])
assert.deepEqual(filterTablesByGroup(tables, 'floor1').map(table => table.id), ['a'])

console.log('table group checks passed')
