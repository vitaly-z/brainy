/**
 * Static Pattern Matcher - NO runtime initialization, NO BrainyData needed
 * 
 * All patterns and embeddings are pre-computed at build time
 * This is pure pattern matching with zero dependencies
 */

import { EMBEDDED_PATTERNS, getPatternEmbeddings } from './embeddedPatterns.js'
import type { Vector } from '../coreTypes.js'
import type { TripleQuery } from '../triple/TripleIntelligence.js'

// Pre-load patterns and embeddings at module load time (happens once)
const patterns = new Map(EMBEDDED_PATTERNS.map(p => [p.id, p]))
const patternEmbeddings = getPatternEmbeddings()

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: Vector, b: Vector): number {
  if (!a || !b || a.length !== b.length) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  return denominator === 0 ? 0 : dotProduct / denominator
}

/**
 * Extract slots from matched pattern
 */
function extractSlots(query: string, pattern: string): Record<string, string> | null {
  try {
    const regex = new RegExp(pattern, 'i')
    const match = query.match(regex)
    
    if (!match) return null
    
    const slots: Record<string, string> = {}
    for (let i = 1; i < match.length; i++) {
      if (match[i]) {
        slots[`$${i}`] = match[i]
      }
    }
    
    return Object.keys(slots).length > 0 ? slots : null
  } catch {
    return null
  }
}

/**
 * Apply template with extracted slots
 */
function applyTemplate(template: any, slots: Record<string, string>): any {
  if (!template || !slots) return template
  
  const result = JSON.parse(JSON.stringify(template))
  const applySlots = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.replace(/\$\{(\d+)\}/g, (_, num) => slots[`$${num}`] || '')
    }
    if (Array.isArray(obj)) {
      return obj.map(applySlots)
    }
    if (typeof obj === 'object' && obj !== null) {
      const newObj: any = {}
      for (const [key, value] of Object.entries(obj)) {
        newObj[key] = applySlots(value)
      }
      return newObj
    }
    return obj
  }
  
  return applySlots(result)
}

/**
 * Match query against all patterns using embeddings
 */
export function findBestPatterns(
  queryEmbedding: Vector,
  k: number = 3
): Array<{ pattern: typeof EMBEDDED_PATTERNS[0]; similarity: number }> {
  
  const matches: Array<{ pattern: typeof EMBEDDED_PATTERNS[0]; similarity: number }> = []
  
  for (const pattern of EMBEDDED_PATTERNS) {
    
    const patternEmbedding = patternEmbeddings.get(pattern.id)
    if (!patternEmbedding) continue
    
    // Pass Float32Array directly, no need for Array.from()!
    const similarity = cosineSimilarity(queryEmbedding, patternEmbedding as any)
    if (similarity > 0.5) { // Threshold for relevance
      matches.push({ pattern, similarity })
    }
  }
  
  // Sort by similarity and return top k
  return matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
}

/**
 * Match query against patterns using regex
 */
export function matchPatternByRegex(query: string): {
  pattern: typeof EMBEDDED_PATTERNS[0]
  slots: Record<string, string>
  query: TripleQuery
} | null {
  // Try direct regex matching first (fastest)
  for (const pattern of EMBEDDED_PATTERNS) {
    const slots = extractSlots(query, pattern.pattern)
    if (slots) {
      const templatedQuery = applyTemplate(pattern.template, slots)
      return {
        pattern,
        slots,
        query: templatedQuery
      }
    }
  }
  
  return null
}

/**
 * Convert natural language to structured query using STATIC patterns
 * NO initialization needed, NO BrainyData required
 */
export function patternMatchQuery(
  query: string,
  queryEmbedding?: Vector
): TripleQuery {
  
  // ALWAYS use vector similarity when we have embeddings (which we always do!)
  if (queryEmbedding && queryEmbedding.length === 384) {
    const bestPatterns = findBestPatterns(queryEmbedding, 5) // Get top 5 matches
    
    // Try to extract slots from best matching patterns
    for (const { pattern, similarity } of bestPatterns) {
      // Only try patterns with good similarity
      if (similarity < 0.7) break
      
      const slots = extractSlots(query, pattern.pattern)
      if (slots) {
        // Found a good match with extractable slots!
        const result = applyTemplate(pattern.template, slots)
        console.log('[NLP] Applied template with slots:', JSON.stringify(result))
        return result
      }
    }
    
    // If no slots extracted but we have a good match, use the template as-is
    if (bestPatterns.length > 0 && bestPatterns[0].similarity > 0.75) {
      console.log('[NLP] Returning template as-is:', JSON.stringify(bestPatterns[0].pattern.template))
      return bestPatterns[0].pattern.template
    }
  }
  
  // Fallback: simple vector search (should rarely happen)
  console.log('[NLP] Fallback - returning simple query')
  return {
    like: query,
    limit: 10
  }
}

// Export pattern statistics for monitoring
export const PATTERN_STATS = {
  totalPatterns: EMBEDDED_PATTERNS.length,
  categories: [...new Set(EMBEDDED_PATTERNS.map(p => p.category))],
  domains: [...new Set(EMBEDDED_PATTERNS.filter(p => p.domain).map(p => p.domain!))],
  hasEmbeddings: patternEmbeddings.size > 0
}