/**
 * Semantic Path Parser
 *
 * Parses semantic filesystem paths into structured queries
 * PURE LOGIC - No external dependencies, no async operations
 *
 * Supported path formats:
 * - Traditional: /src/auth.ts
 * - By Concept: /by-concept/authentication/login.ts
 * - By Author: /by-author/alice/file.ts
 * - By Time: /as-of/2024-03-15/file.ts
 * - By Relationship: /related-to/src/auth.ts/depth-2
 * - By Similarity: /similar-to/src/auth.ts/threshold-0.8
 * - By Tag: /by-tag/security/file.ts
 */

export type SemanticDimension =
  | 'traditional'
  | 'concept'
  | 'author'
  | 'time'
  | 'relationship'
  | 'similar'
  | 'tag'

export interface ParsedSemanticPath {
  dimension: SemanticDimension
  value: string | Date | RelationshipValue | SimilarityValue
  subpath?: string
  filters?: Record<string, any>
}

export interface RelationshipValue {
  targetPath: string
  depth?: number
  relationshipTypes?: string[]
}

export interface SimilarityValue {
  targetPath: string
  threshold?: number
}

/**
 * Semantic Path Parser
 * Parses various semantic path formats into structured data
 */
export class SemanticPathParser {
  // Regex patterns for each dimension
  private static readonly PATTERNS = {
    concept: /^\/by-concept\/([^\/]+)(?:\/(.+))?$/,
    author: /^\/by-author\/([^\/]+)(?:\/(.+))?$/,
    time: /^\/as-of\/(\d{4}-\d{2}-\d{2})(?:\/(.+))?$/,
    // Relationship: /related-to/<path>/depth-N/types-X,Y/<subpath>
    // Must handle paths with slashes, so capture everything before /depth- or /types-
    relationship: /^\/related-to\/(.+?)(?:\/depth-(\d+)|\/types-([^\/]+)|\/(.+))*$/,
    // Similarity: /similar-to/<path>/threshold-N/<subpath>
    similar: /^\/similar-to\/(.+?)(?:\/threshold-([\d.]+)|\/(.+))*$/,
    tag: /^\/by-tag\/([^\/]+)(?:\/(.+))?$/
  }

  /**
   * Parse a path into semantic components
   * PURE FUNCTION - no external calls, no async
   */
  parse(path: string): ParsedSemanticPath {
    if (!path || typeof path !== 'string') {
      throw new Error('Path must be a non-empty string')
    }

    // Normalize path
    const normalized = this.normalizePath(path)

    // Try concept dimension
    const conceptMatch = normalized.match(SemanticPathParser.PATTERNS.concept)
    if (conceptMatch) {
      return {
        dimension: 'concept',
        value: conceptMatch[1],
        subpath: conceptMatch[2]
      }
    }

    // Try author dimension
    const authorMatch = normalized.match(SemanticPathParser.PATTERNS.author)
    if (authorMatch) {
      return {
        dimension: 'author',
        value: authorMatch[1],
        subpath: authorMatch[2]
      }
    }

    // Try time dimension
    const timeMatch = normalized.match(SemanticPathParser.PATTERNS.time)
    if (timeMatch) {
      const dateStr = timeMatch[1]
      const date = this.parseDate(dateStr)

      return {
        dimension: 'time',
        value: date,
        subpath: timeMatch[2]
      }
    }

    // Try relationship dimension
    if (normalized.startsWith('/related-to/')) {
      return this.parseRelationshipPath(normalized)
    }

    // Try similarity dimension
    if (normalized.startsWith('/similar-to/')) {
      return this.parseSimilarityPath(normalized)
    }

    // Try tag dimension
    const tagMatch = normalized.match(SemanticPathParser.PATTERNS.tag)
    if (tagMatch) {
      return {
        dimension: 'tag',
        value: tagMatch[1],
        subpath: tagMatch[2]
      }
    }

    // Default to traditional path
    return {
      dimension: 'traditional',
      value: normalized
    }
  }

  /**
   * Check if a path is semantic (non-traditional)
   */
  isSemanticPath(path: string): boolean {
    if (!path || typeof path !== 'string') {
      return false
    }

    const normalized = this.normalizePath(path)

    // Check if matches any semantic pattern
    return (
      normalized.startsWith('/by-concept/') ||
      normalized.startsWith('/by-author/') ||
      normalized.startsWith('/as-of/') ||
      normalized.startsWith('/related-to/') ||
      normalized.startsWith('/similar-to/') ||
      normalized.startsWith('/by-tag/')
    )
  }

  /**
   * Get the dimension type from a path
   */
  getDimension(path: string): SemanticDimension {
    return this.parse(path).dimension
  }

  /**
   * Normalize a path - remove trailing slashes, collapse multiple slashes
   * PURE FUNCTION
   */
  private normalizePath(path: string): string {
    // Remove trailing slash (except for root)
    let normalized = path.replace(/\/+$/, '')

    // Collapse multiple slashes
    normalized = normalized.replace(/\/+/g, '/')

    // Ensure starts with /
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized
    }

    // Special case: empty path becomes /
    if (normalized === '') {
      normalized = '/'
    }

    return normalized
  }

  /**
   * Parse date string (YYYY-MM-DD) into Date object
   * PURE FUNCTION
   */
  private parseDate(dateStr: string): Date {
    const parts = dateStr.split('-')
    if (parts.length !== 3) {
      throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`)
    }

    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1  // Months are 0-indexed in JS
    const day = parseInt(parts[2], 10)

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`)
    }

    if (year < 1900 || year > 2100) {
      throw new Error(`Invalid year: ${year}. Expected 1900-2100`)
    }

    if (month < 0 || month > 11) {
      throw new Error(`Invalid month: ${month + 1}. Expected 1-12`)
    }

    if (day < 1 || day > 31) {
      throw new Error(`Invalid day: ${day}. Expected 1-31`)
    }

    return new Date(year, month, day)
  }

  /**
   * Validate parsed path structure
   */
  validate(parsed: ParsedSemanticPath): boolean {
    if (!parsed || typeof parsed !== 'object') {
      return false
    }

    if (!parsed.dimension) {
      return false
    }

    if (parsed.value === undefined || parsed.value === null) {
      return false
    }

    // Dimension-specific validation
    switch (parsed.dimension) {
      case 'time':
        return parsed.value instanceof Date && !isNaN(parsed.value.getTime())

      case 'relationship':
        const relValue = parsed.value as RelationshipValue
        return typeof relValue.targetPath === 'string' && relValue.targetPath.length > 0

      case 'similar':
        const simValue = parsed.value as SimilarityValue
        return typeof simValue.targetPath === 'string' && simValue.targetPath.length > 0

      default:
        return typeof parsed.value === 'string' && parsed.value.length > 0
    }
  }

  /**
   * Parse relationship paths: /related-to/<path>/depth-N/types-X,Y/<subpath>
   */
  private parseRelationshipPath(path: string): ParsedSemanticPath {
    // Remove /related-to/ prefix
    const withoutPrefix = path.substring('/related-to/'.length)

    // Split into segments
    const segments = withoutPrefix.split('/')

    let targetPath = ''
    let depth: number | undefined
    let types: string[] | undefined
    let subpath: string | undefined
    let i = 0

    // Collect path segments until we hit depth-, types-, or end
    while (i < segments.length) {
      const segment = segments[i]

      if (segment.startsWith('depth-')) {
        depth = parseInt(segment.substring('depth-'.length), 10)
        i++
        continue
      }

      if (segment.startsWith('types-')) {
        types = segment.substring('types-'.length).split(',')
        i++
        continue
      }

      // If we've already collected the target path and found depth/types,
      // rest is subpath
      if (targetPath && (depth !== undefined || types !== undefined)) {
        subpath = segments.slice(i).join('/')
        break
      }

      // Add to target path
      if (targetPath) {
        targetPath += '/' + segment
      } else {
        targetPath = segment
      }
      i++
    }

    const value: RelationshipValue = {
      targetPath,
      depth,
      relationshipTypes: types
    }

    return {
      dimension: 'relationship',
      value,
      subpath
    }
  }

  /**
   * Parse similarity paths: /similar-to/<path>/threshold-N/<subpath>
   */
  private parseSimilarityPath(path: string): ParsedSemanticPath {
    // Remove /similar-to/ prefix
    const withoutPrefix = path.substring('/similar-to/'.length)

    // Split into segments
    const segments = withoutPrefix.split('/')

    let targetPath = ''
    let threshold: number | undefined
    let subpath: string | undefined
    let i = 0

    // Collect path segments until we hit threshold- or end
    while (i < segments.length) {
      const segment = segments[i]

      if (segment.startsWith('threshold-')) {
        threshold = parseFloat(segment.substring('threshold-'.length))
        i++
        // Rest is subpath
        if (i < segments.length) {
          subpath = segments.slice(i).join('/')
        }
        break
      }

      // Add to target path
      if (targetPath) {
        targetPath += '/' + segment
      } else {
        targetPath = segment
      }
      i++
    }

    const value: SimilarityValue = {
      targetPath,
      threshold
    }

    return {
      dimension: 'similar',
      value,
      subpath
    }
  }
}