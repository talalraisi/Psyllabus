export function countInGroup(selectedSubjects, group) {
  return selectedSubjects.filter((s) => group.subjects.includes(s)).length
}

export function isIBSelectionValid(selectedSubjects, groups) {
  const group1 = groups.find((g) => g.name.includes('Group 1'))
  const group2 = groups.find((g) => g.name.includes('Group 2'))
  const group3 = groups.find((g) => g.name.includes('Group 3'))
  const group4 = groups.find((g) => g.name.includes('Group 4'))
  const group5 = groups.find((g) => g.name.includes('Group 5'))

  if (!group1 || !group2 || !group3 || !group4 || !group5) return selectedSubjects.length > 0

  const g1 = countInGroup(selectedSubjects, group1)
  const g2 = countInGroup(selectedSubjects, group2)

  return (
    g1 >= 1 &&
    (g1 >= 2 || g2 >= 1) &&
    countInGroup(selectedSubjects, group3) >= 1 &&
    countInGroup(selectedSubjects, group4) >= 1 &&
    countInGroup(selectedSubjects, group5) >= 1
  )
}

export function ibSelectionHint(selectedSubjects, groups) {
  const group1 = groups.find((g) => g.name.includes('Group 1'))
  const group2 = groups.find((g) => g.name.includes('Group 2'))
  const group3 = groups.find((g) => g.name.includes('Group 3'))
  const group4 = groups.find((g) => g.name.includes('Group 4'))
  const group5 = groups.find((g) => g.name.includes('Group 5'))

  const g1 = group1 ? countInGroup(selectedSubjects, group1) : 0
  const g2 = group2 ? countInGroup(selectedSubjects, group2) : 0
  const g3 = group3 ? countInGroup(selectedSubjects, group3) : 0
  const g4 = group4 ? countInGroup(selectedSubjects, group4) : 0
  const g5 = group5 ? countInGroup(selectedSubjects, group5) : 0

  const missing = []
  if (g1 < 1) missing.push('Group 1')
  if (g1 < 2 && g2 < 1) missing.push('Group 2 (unless you take 2 Group 1 subjects)')
  if (g3 < 1) missing.push('Group 3')
  if (g4 < 1) missing.push('Group 4')
  if (g5 < 1) missing.push('Group 5')

  if (missing.length > 0) {
    return `Need: ${missing.join(', ')}. Group 6 is optional.`
  }

  if (g1 >= 2) {
    return 'Bilingual diploma! Language B not required. TOK, EE, and CAS are automatically included.'
  }

  return 'Complete! TOK, EE, and CAS are automatically included.'
}
