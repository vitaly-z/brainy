/**
 * Tests for SemanticPathParser
 * REAL TESTS - No mocks, pure logic testing
 */

import { describe, test, expect } from 'vitest'
import {
  SemanticPathParser,
  ParsedSemanticPath,
  RelationshipValue,
  SimilarityValue
} from '../../../src/vfs/semantic/SemanticPathParser.js'

describe('SemanticPathParser', () => {
  const parser = new SemanticPathParser()

  describe('Traditional Paths', () => {
    test('parses simple traditional path', () => {
      const result = parser.parse('/src/auth.ts')

      expect(result.dimension).toBe('traditional')
      expect(result.value).toBe('/src/auth.ts')
      expect(result.subpath).toBeUndefined()
    })

    test('parses nested traditional path', () => {
      const result = parser.parse('/src/lib/utils/helper.ts')

      expect(result.dimension).toBe('traditional')
      expect(result.value).toBe('/src/lib/utils/helper.ts')
    })

    test('parses root path', () => {
      const result = parser.parse('/')

      expect(result.dimension).toBe('traditional')
      expect(result.value).toBe('/')
    })

    test('normalizes paths with trailing slash', () => {
      const result = parser.parse('/src/auth.ts/')

      expect(result.dimension).toBe('traditional')
      expect(result.value).toBe('/src/auth.ts')
    })

    test('normalizes paths with multiple slashes', () => {
      const result = parser.parse('//src///auth.ts')

      expect(result.dimension).toBe('traditional')
      expect(result.value).toBe('/src/auth.ts')
    })

    test('adds leading slash if missing', () => {
      const result = parser.parse('src/auth.ts')

      expect(result.dimension).toBe('traditional')
      expect(result.value).toBe('/src/auth.ts')
    })
  })

  describe('Concept Paths', () => {
    test('parses concept path without subpath', () => {
      const result = parser.parse('/by-concept/authentication')

      expect(result.dimension).toBe('concept')
      expect(result.value).toBe('authentication')
      expect(result.subpath).toBeUndefined()
    })

    test('parses concept path with subpath', () => {
      const result = parser.parse('/by-concept/authentication/login.ts')

      expect(result.dimension).toBe('concept')
      expect(result.value).toBe('authentication')
      expect(result.subpath).toBe('login.ts')
    })

    test('parses concept path with nested subpath', () => {
      const result = parser.parse('/by-concept/security/src/auth/login.ts')

      expect(result.dimension).toBe('concept')
      expect(result.value).toBe('security')
      expect(result.subpath).toBe('src/auth/login.ts')
    })

    test('parses concept with dashes', () => {
      const result = parser.parse('/by-concept/dependency-injection/service.ts')

      expect(result.dimension).toBe('concept')
      expect(result.value).toBe('dependency-injection')
      expect(result.subpath).toBe('service.ts')
    })
  })

  describe('Author Paths', () => {
    test('parses author path without subpath', () => {
      const result = parser.parse('/by-author/alice')

      expect(result.dimension).toBe('author')
      expect(result.value).toBe('alice')
      expect(result.subpath).toBeUndefined()
    })

    test('parses author path with subpath', () => {
      const result = parser.parse('/by-author/alice/code.ts')

      expect(result.dimension).toBe('author')
      expect(result.value).toBe('alice')
      expect(result.subpath).toBe('code.ts')
    })

    test('parses author path with nested subpath', () => {
      const result = parser.parse('/by-author/bob/projects/2024/file.ts')

      expect(result.dimension).toBe('author')
      expect(result.value).toBe('bob')
      expect(result.subpath).toBe('projects/2024/file.ts')
    })
  })

  describe('Time Paths', () => {
    test('parses time path without subpath', () => {
      const result = parser.parse('/as-of/2024-03-15')

      expect(result.dimension).toBe('time')
      expect(result.value).toBeInstanceOf(Date)
      expect((result.value as Date).getFullYear()).toBe(2024)
      expect((result.value as Date).getMonth()).toBe(2)  // March is index 2
      expect((result.value as Date).getDate()).toBe(15)
      expect(result.subpath).toBeUndefined()
    })

    test('parses time path with subpath', () => {
      const result = parser.parse('/as-of/2024-03-15/src/auth.ts')

      expect(result.dimension).toBe('time')
      expect(result.value).toBeInstanceOf(Date)
      expect(result.subpath).toBe('src/auth.ts')
    })

    test('treats invalid date format as traditional path', () => {
      // Doesn't match the time pattern, so becomes traditional
      const result = parser.parse('/as-of/2024-03/file.ts')
      expect(result.dimension).toBe('traditional')
    })

    test('treats invalid date components as traditional path', () => {
      // Doesn't match the time pattern, so becomes traditional
      const result = parser.parse('/as-of/invalid-date/file.ts')
      expect(result.dimension).toBe('traditional')
    })

    test('throws on invalid year', () => {
      expect(() => parser.parse('/as-of/1800-03-15/file.ts')).toThrow('Invalid year')
    })

    test('throws on invalid month', () => {
      expect(() => parser.parse('/as-of/2024-13-15/file.ts')).toThrow('Invalid month')
    })

    test('throws on invalid day', () => {
      expect(() => parser.parse('/as-of/2024-03-32/file.ts')).toThrow('Invalid day')
    })
  })

  describe('Relationship Paths', () => {
    test('parses relationship path without depth', () => {
      const result = parser.parse('/related-to/src/auth.ts')

      expect(result.dimension).toBe('relationship')
      const value = result.value as RelationshipValue
      expect(value.targetPath).toBe('src/auth.ts')
      expect(value.depth).toBeUndefined()
      expect(value.relationshipTypes).toBeUndefined()
    })

    test('parses relationship path with depth', () => {
      const result = parser.parse('/related-to/src/auth.ts/depth-2')

      expect(result.dimension).toBe('relationship')
      const value = result.value as RelationshipValue
      expect(value.targetPath).toBe('src/auth.ts')
      expect(value.depth).toBe(2)
    })

    test('parses relationship path with types', () => {
      const result = parser.parse('/related-to/src/auth.ts/types-uses,imports')

      expect(result.dimension).toBe('relationship')
      const value = result.value as RelationshipValue
      expect(value.targetPath).toBe('src/auth.ts')
      expect(value.relationshipTypes).toEqual(['uses', 'imports'])
    })

    test('parses relationship path with depth, types, and subpath', () => {
      const result = parser.parse('/related-to/src/auth.ts/depth-3/types-uses,imports/helper.ts')

      expect(result.dimension).toBe('relationship')
      const value = result.value as RelationshipValue
      expect(value.targetPath).toBe('src/auth.ts')
      expect(value.depth).toBe(3)
      expect(value.relationshipTypes).toEqual(['uses', 'imports'])
      expect(result.subpath).toBe('helper.ts')
    })
  })

  describe('Similarity Paths', () => {
    test('parses similarity path without threshold', () => {
      const result = parser.parse('/similar-to/src/auth.ts')

      expect(result.dimension).toBe('similar')
      const value = result.value as SimilarityValue
      expect(value.targetPath).toBe('src/auth.ts')
      expect(value.threshold).toBeUndefined()
    })

    test('parses similarity path with threshold', () => {
      const result = parser.parse('/similar-to/src/auth.ts/threshold-0.85')

      expect(result.dimension).toBe('similar')
      const value = result.value as SimilarityValue
      expect(value.targetPath).toBe('src/auth.ts')
      expect(value.threshold).toBe(0.85)
    })

    test('parses similarity path with threshold and subpath', () => {
      const result = parser.parse('/similar-to/src/auth.ts/threshold-0.7/login.ts')

      expect(result.dimension).toBe('similar')
      const value = result.value as SimilarityValue
      expect(value.targetPath).toBe('src/auth.ts')
      expect(value.threshold).toBe(0.7)
      expect(result.subpath).toBe('login.ts')
    })
  })

  describe('Tag Paths', () => {
    test('parses tag path without subpath', () => {
      const result = parser.parse('/by-tag/security')

      expect(result.dimension).toBe('tag')
      expect(result.value).toBe('security')
      expect(result.subpath).toBeUndefined()
    })

    test('parses tag path with subpath', () => {
      const result = parser.parse('/by-tag/security/auth.ts')

      expect(result.dimension).toBe('tag')
      expect(result.value).toBe('security')
      expect(result.subpath).toBe('auth.ts')
    })

    test('parses tag with dashes', () => {
      const result = parser.parse('/by-tag/code-review/file.ts')

      expect(result.dimension).toBe('tag')
      expect(result.value).toBe('code-review')
      expect(result.subpath).toBe('file.ts')
    })
  })

  describe('isSemanticPath', () => {
    test('returns false for traditional paths', () => {
      expect(parser.isSemanticPath('/src/auth.ts')).toBe(false)
      expect(parser.isSemanticPath('/projects/main/file.ts')).toBe(false)
      expect(parser.isSemanticPath('/')).toBe(false)
    })

    test('returns true for concept paths', () => {
      expect(parser.isSemanticPath('/by-concept/auth')).toBe(true)
      expect(parser.isSemanticPath('/by-concept/auth/file.ts')).toBe(true)
    })

    test('returns true for author paths', () => {
      expect(parser.isSemanticPath('/by-author/alice')).toBe(true)
    })

    test('returns true for time paths', () => {
      expect(parser.isSemanticPath('/as-of/2024-03-15')).toBe(true)
    })

    test('returns true for relationship paths', () => {
      expect(parser.isSemanticPath('/related-to/src/auth.ts')).toBe(true)
    })

    test('returns true for similarity paths', () => {
      expect(parser.isSemanticPath('/similar-to/src/auth.ts')).toBe(true)
    })

    test('returns true for tag paths', () => {
      expect(parser.isSemanticPath('/by-tag/security')).toBe(true)
    })

    test('handles invalid input gracefully', () => {
      expect(parser.isSemanticPath('')).toBe(false)
      expect(parser.isSemanticPath(null as any)).toBe(false)
      expect(parser.isSemanticPath(undefined as any)).toBe(false)
    })
  })

  describe('getDimension', () => {
    test('returns correct dimension for each path type', () => {
      expect(parser.getDimension('/src/auth.ts')).toBe('traditional')
      expect(parser.getDimension('/by-concept/auth')).toBe('concept')
      expect(parser.getDimension('/by-author/alice')).toBe('author')
      expect(parser.getDimension('/as-of/2024-03-15')).toBe('time')
      expect(parser.getDimension('/related-to/src/file.ts')).toBe('relationship')
      expect(parser.getDimension('/similar-to/src/file.ts')).toBe('similar')
      expect(parser.getDimension('/by-tag/security')).toBe('tag')
    })
  })

  describe('validate', () => {
    test('validates correct parsed paths', () => {
      const valid: ParsedSemanticPath = {
        dimension: 'concept',
        value: 'authentication'
      }
      expect(parser.validate(valid)).toBe(true)
    })

    test('validates time paths with Date objects', () => {
      const valid: ParsedSemanticPath = {
        dimension: 'time',
        value: new Date('2024-03-15')
      }
      expect(parser.validate(valid)).toBe(true)
    })

    test('validates relationship paths', () => {
      const valid: ParsedSemanticPath = {
        dimension: 'relationship',
        value: { targetPath: '/src/auth.ts', depth: 2 }
      }
      expect(parser.validate(valid)).toBe(true)
    })

    test('validates similarity paths', () => {
      const valid: ParsedSemanticPath = {
        dimension: 'similar',
        value: { targetPath: '/src/auth.ts', threshold: 0.8 }
      }
      expect(parser.validate(valid)).toBe(true)
    })

    test('rejects invalid structures', () => {
      expect(parser.validate(null as any)).toBe(false)
      expect(parser.validate(undefined as any)).toBe(false)
      expect(parser.validate({} as any)).toBe(false)
    })

    test('rejects missing dimension', () => {
      expect(parser.validate({ value: 'test' } as any)).toBe(false)
    })

    test('rejects missing value', () => {
      expect(parser.validate({ dimension: 'concept' } as any)).toBe(false)
    })

    test('rejects invalid time values', () => {
      const invalid: ParsedSemanticPath = {
        dimension: 'time',
        value: 'not-a-date' as any
      }
      expect(parser.validate(invalid)).toBe(false)
    })

    test('rejects invalid relationship values', () => {
      const invalid: ParsedSemanticPath = {
        dimension: 'relationship',
        value: { targetPath: '' } as any
      }
      expect(parser.validate(invalid)).toBe(false)
    })
  })

  describe('Error Handling', () => {
    test('throws on null path', () => {
      expect(() => parser.parse(null as any)).toThrow('Path must be a non-empty string')
    })

    test('throws on undefined path', () => {
      expect(() => parser.parse(undefined as any)).toThrow('Path must be a non-empty string')
    })

    test('throws on empty string', () => {
      expect(() => parser.parse('')).toThrow('Path must be a non-empty string')
    })

    test('throws on non-string path', () => {
      expect(() => parser.parse(123 as any)).toThrow('Path must be a non-empty string')
    })
  })

  describe('Edge Cases', () => {
    test('handles paths with special characters in concepts', () => {
      const result = parser.parse('/by-concept/oauth-2.0/auth.ts')
      expect(result.dimension).toBe('concept')
      expect(result.value).toBe('oauth-2.0')
    })

    test('handles paths with underscores', () => {
      const result = parser.parse('/by-concept/user_authentication/login.ts')
      expect(result.dimension).toBe('concept')
      expect(result.value).toBe('user_authentication')
    })

    test('handles deeply nested subpaths', () => {
      const result = parser.parse('/by-concept/auth/src/lib/utils/helpers/validators/email.ts')
      expect(result.dimension).toBe('concept')
      expect(result.value).toBe('auth')
      expect(result.subpath).toBe('src/lib/utils/helpers/validators/email.ts')
    })

    test('handles paths with dots', () => {
      const result = parser.parse('/by-author/alice/v2.0.0/file.ts')
      expect(result.dimension).toBe('author')
      expect(result.value).toBe('alice')
      expect(result.subpath).toBe('v2.0.0/file.ts')
    })
  })
})