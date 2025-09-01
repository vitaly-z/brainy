import { NounType, VerbType } from '../types/graphTypes.js'

// Type sets for O(1) validation
const VALID_NOUN_TYPES = new Set<string>(Object.values(NounType))
const VALID_VERB_TYPES = new Set<string>(Object.values(VerbType))

// Type guards
export function isValidNounType(type: unknown): type is NounType {
  return typeof type === 'string' && VALID_NOUN_TYPES.has(type as string)
}

export function isValidVerbType(type: unknown): type is VerbType {
  return typeof type === 'string' && VALID_VERB_TYPES.has(type as string)
}

// Validators with helpful errors
export function validateNounType(type: unknown): NounType {
  if (!isValidNounType(type)) {
    const suggestion = findClosestMatch(String(type), VALID_NOUN_TYPES)
    throw new Error(
      `Invalid noun type: '${type}'. ${suggestion ? `Did you mean '${suggestion}'?` : ''} ` +
      `Valid types are: ${[...VALID_NOUN_TYPES].sort().join(', ')}`
    )
  }
  return type
}

export function validateVerbType(type: unknown): VerbType {
  if (!isValidVerbType(type)) {
    const suggestion = findClosestMatch(String(type), VALID_VERB_TYPES)
    throw new Error(
      `Invalid verb type: '${type}'. ${suggestion ? `Did you mean '${suggestion}'?` : ''} ` +
      `Valid types are: ${[...VALID_VERB_TYPES].sort().join(', ')}`
    )
  }
  return type
}

// Graph entity validators
export interface ValidatedGraphNoun {
  noun: NounType
  [key: string]: any
}

export interface ValidatedGraphVerb {
  verb: VerbType
  [key: string]: any
}

export function validateGraphNoun(noun: unknown): ValidatedGraphNoun {
  if (!noun || typeof noun !== 'object') {
    throw new Error('Invalid noun: must be an object')
  }
  const n = noun as any
  if (!n.noun) {
    throw new Error('Invalid noun: missing required "noun" type field')
  }
  n.noun = validateNounType(n.noun)
  return n as ValidatedGraphNoun
}

export function validateGraphVerb(verb: unknown): ValidatedGraphVerb {
  if (!verb || typeof verb !== 'object') {
    throw new Error('Invalid verb: must be an object')
  }
  const v = verb as any
  if (!v.verb) {
    throw new Error('Invalid verb: missing required "verb" type field')
  }
  v.verb = validateVerbType(v.verb)
  return v as ValidatedGraphVerb
}

// Helper for suggestions using Levenshtein distance
function findClosestMatch(input: string, validSet: Set<string>): string | null {
  if (!input) return null
  
  const lower = input.toLowerCase()
  let bestMatch: string | null = null
  let bestScore = Infinity
  
  for (const valid of validSet) {
    const validLower = valid.toLowerCase()
    
    // Exact match (case-insensitive)
    if (validLower === lower) {
      return valid
    }
    
    // Substring match
    if (validLower.includes(lower) || lower.includes(validLower)) {
      return valid
    }
    
    // Calculate Levenshtein distance
    const distance = levenshteinDistance(lower, validLower)
    if (distance < bestScore && distance <= 3) { // Threshold of 3 for suggestions
      bestScore = distance
      bestMatch = valid
    }
  }
  
  return bestMatch
}

// Levenshtein distance implementation
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
  
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i
  }
  
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j
  }
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        )
      }
    }
  }
  
  return dp[m][n]
}

// Batch validation helpers
export function validateNounTypes(types: unknown[]): NounType[] {
  return types.map(validateNounType)
}

export function validateVerbTypes(types: unknown[]): VerbType[] {
  return types.map(validateVerbType)
}


// Export validation statistics for monitoring
export interface ValidationStats {
  validated: number
  failed: number
  inferred: number
  suggestions: number
}

let stats: ValidationStats = {
  validated: 0,
  failed: 0,
  inferred: 0,
  suggestions: 0
}

export function getValidationStats(): ValidationStats {
  return { ...stats }
}

export function resetValidationStats(): void {
  stats = {
    validated: 0,
    failed: 0,
    inferred: 0,
    suggestions: 0
  }
}