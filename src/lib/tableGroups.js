export const ALL_TABLE_GROUP = { id: 'all', name: 'すべて' }

export function normalizeTableGroupName(name) {
  return name.trim()
}

export function sortTableGroups(groups) {
  return [...groups].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (orderDiff !== 0) return orderDiff
    return (a.name ?? '').localeCompare(b.name ?? '', 'ja')
  })
}

export function buildTableGroupTabs(groups) {
  return [ALL_TABLE_GROUP, ...sortTableGroups(groups)]
}

export function filterTablesByGroup(tables, groupId) {
  if (!groupId || groupId === ALL_TABLE_GROUP.id) return tables
  return tables.filter(table => table.groupId === groupId)
}
