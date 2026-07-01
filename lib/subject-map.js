/** Maps onboarding subject names → CSV / database subject names */
export const SUBJECT_MAP = {
  // Group 1 - Studies in Language and Literature
  'English A: Literature HL': 'English A: Literature (SL/HL)',
  'English A: Literature SL': 'English A: Literature (SL/HL)',
  'English A: Language & Literature HL': 'English A: Language and Literature (SL/HL)',
  'English A: Language & Literature SL': 'English A: Language and Literature (SL/HL)',
  'Literature and Performance SL': 'Literature and Performance (SL only)',
  'Spanish A: Language & Literature HL': 'Spanish A: Language and Literature (SL/HL)',
  'Spanish A: Language & Literature SL': 'Spanish A: Language and Literature (SL/HL)',
  'French A: Language & Literature HL': 'French A: Language and Literature (SL/HL)',
  'French A: Language & Literature SL': 'French A: Language and Literature (SL/HL)',
  'Arabic A: Language & Literature HL': 'Arabic A: Language and Literature (SL/HL)',
  'Arabic A: Language & Literature SL': 'Arabic A: Language and Literature (SL/HL)',
  'Mandarin A: Language & Literature HL': 'Mandarin A: Language and Literature (SL/HL)',
  'Mandarin A: Language & Literature SL': 'Mandarin A: Language and Literature (SL/HL)',
  // Group 2 - Language Acquisition
  'Spanish B HL': 'Spanish B (SL/HL)',
  'Spanish B SL': 'Spanish B (SL/HL)',
  'Spanish ab initio SL': 'Spanish ab initio (SL)',
  'French B HL': 'French B (SL/HL)',
  'French B SL': 'French B (SL/HL)',
  'French ab initio SL': 'French ab initio (SL)',
  'Arabic B HL': 'Arabic B (SL/HL)',
  'Arabic B SL': 'Arabic B (SL/HL)',
  'Arabic ab initio SL': 'Arabic ab initio (SL)',
  'English B HL': 'English B (SL/HL)',
  'English B SL': 'English B (SL/HL)',
  'English ab initio SL': 'English ab initio (SL)',
  'Mandarin B HL': 'Mandarin B (SL/HL)',
  'Mandarin B SL': 'Mandarin B (SL/HL)',
  'Mandarin ab initio SL': 'Mandarin ab initio (SL)',
  'Classical Languages: Latin HL': 'Classical Languages: Latin (SL/HL)',
  'Classical Languages: Latin SL': 'Classical Languages: Latin (SL/HL)',
  'Classical Languages: Classical Greek HL': 'Classical Languages: Classical Greek (SL/HL)',
  'Classical Languages: Classical Greek SL': 'Classical Languages: Classical Greek (SL/HL)',
  // Group 3 - Individuals and Societies
  'Business Management HL': 'Business Management (SL/HL)',
  'Business Management SL': 'Business Management (SL/HL)',
  'Digital Society HL': 'Digital Society (SL/HL)',
  'Digital Society SL': 'Digital Society (SL/HL)',
  'Economics HL': 'Economics (SL/HL)',
  'Economics SL': 'Economics (SL/HL)',
  'Geography HL': 'Geography (SL/HL)',
  'Geography SL': 'Geography (SL/HL)',
  'Global Politics HL': 'Global Politics (SL/HL)',
  'Global Politics SL': 'Global Politics (SL/HL)',
  'History HL': 'History (SL/HL)',
  'History SL': 'History (SL/HL)',
  'Philosophy HL': 'Philosophy (SL/HL)',
  'Philosophy SL': 'Philosophy (SL/HL)',
  'Psychology HL': 'Psychology (SL/HL)',
  'Psychology SL': 'Psychology (SL/HL)',
  'Social and Cultural Anthropology HL': 'Social and Cultural Anthropology (SL/HL)',
  'Social and Cultural Anthropology SL': 'Social and Cultural Anthropology (SL/HL)',
  'World Religions SL': 'World Religions (SL only)',
  // Group 4 - Sciences
  'Biology HL': 'Biology (SL/HL)',
  'Biology SL': 'Biology (SL/HL)',
  'Chemistry HL': 'Chemistry (SL/HL)',
  'Chemistry SL': 'Chemistry (SL/HL)',
  'Physics HL': 'Physics (SL/HL)',
  'Physics SL': 'Physics (SL/HL)',
  'Computer Science HL': 'Computer Science (SL/HL)',
  'Computer Science SL': 'Computer Science (SL/HL)',
  'Environmental Systems and Societies HL': 'Environmental Systems and Societies (SL/HL)',
  'Environmental Systems and Societies SL': 'Environmental Systems and Societies (SL/HL)',
  'Sports, Exercise, and Health Science HL': 'Sports, Exercise, and Health Science (SL/HL)',
  'Sports, Exercise, and Health Science SL': 'Sports, Exercise, and Health Science (SL/HL)',
  'Design Technology HL': 'Design Technology (SL/HL)',
  'Design Technology SL': 'Design Technology (SL/HL)',
  // Group 5 - Mathematics
  'Math Analysis & Approaches HL': 'Mathematics: Analysis and Approaches (SL/HL)',
  'Math Analysis & Approaches SL': 'Mathematics: Analysis and Approaches (SL/HL)',
  'Math Applications & Interpretation HL': 'Mathematics: Applications and Interpretation (SL/HL)',
  'Math Applications & Interpretation SL': 'Mathematics: Applications and Interpretation (SL/HL)',
  // Group 6 - The Arts
  'Dance HL': 'Dance (SL/HL)',
  'Dance SL': 'Dance (SL/HL)',
  'Film HL': 'Film (SL/HL)',
  'Film SL': 'Film (SL/HL)',
  'Music HL': 'Music (SL/HL)',
  'Music SL': 'Music (SL/HL)',
  'Theatre HL': 'Theatre (SL/HL)',
  'Theatre SL': 'Theatre (SL/HL)',
  'Visual Arts HL': 'Visual Arts (SL/HL)',
  'Visual Arts SL': 'Visual Arts (SL/HL)',
  // DP Core
  'Theory of Knowledge (TOK)': 'Theory of Knowledge (TOK)',
  'Extended Essay (EE)': 'Extended Essay (EE)',
  'Creativity, Activity, Service (CAS)': 'Creativity, Activity, Service (CAS)',
}

export function getDbSubjectName(onboardingName) {
  return SUBJECT_MAP[onboardingName] ?? null
}

export function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function getSlugForSubject(onboardingName) {
  return toSlug(onboardingName)
}

export function resolveOnboardingNameFromSlug(slug) {
  return Object.keys(SUBJECT_MAP).find((name) => toSlug(name) === slug) ?? null
}

export function hasSyllabusData(onboardingName) {
  return onboardingName in SUBJECT_MAP
}
