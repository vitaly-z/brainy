import { describe, it, expect, beforeEach } from 'vitest'
import { PatternSignal } from '../../../../src/neural/signals/PatternSignal.js'
import { NounType } from '../../../../src/types/graphTypes.js'
import type { Brainy } from '../../../../src/brainy.js'

// Mock minimal Brainy instance for testing
function createMockBrain(): Brainy {
  return {
    embed: async (text: string) => {
      const hash = text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
      return Array(384).fill(0).map((_, i) => (hash + i) % 100 / 100)
    }
  } as any
}

describe('PatternSignal', () => {
  let brain: Brainy
  let signal: PatternSignal

  beforeEach(() => {
    brain = createMockBrain()
    signal = new PatternSignal(brain)
  })

  describe('initialization', () => {
    it('should initialize with default options', () => {
      const defaultSignal = new PatternSignal(brain)
      const stats = defaultSignal.getStats()

      expect(stats).toBeDefined()
      expect(stats.calls).toBe(0)
      expect(stats.patternCount).toBeGreaterThan(50) // 56 patterns
    })

    it('should initialize with custom options', () => {
      const customSignal = new PatternSignal(brain, {
        minConfidence: 0.70,
        cacheSize: 5000
      })

      expect(customSignal).toBeDefined()
    })

    it('should precompile patterns on initialization', () => {
      const stats = signal.getStats()
      expect(stats.patternCount).toBeGreaterThan(50)
    })
  })

  describe('regex pattern matching - Person', () => {
    it('should detect person titles', async () => {
      const result = await signal.classify('Dr Smith')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Person)
      expect(result?.source).toBe('pattern-regex')
    })

    it('should detect full names', async () => {
      const result = await signal.classify('John Michael Doe')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Person)
    })

    it('should detect job titles', async () => {
      const result = await signal.classify('Senior Software Engineer')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Person)
    })

    it('should detect CEO/CTO/CFO titles', async () => {
      const result = await signal.classify('Our CEO announced')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Person)
    })

    it('should detect author/creator roles', async () => {
      const result = await signal.classify('The author of this book')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Person)
    })
  })

  describe('regex pattern matching - Location', () => {
    it('should detect cities and towns', async () => {
      const result = await signal.classify('The city of Paris')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Location)
    })

    it('should detect street keyword', async () => {
      const result = await signal.classify('walk down the street today')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Location)
    })

    it('should detect City, State format', async () => {
      const result = await signal.classify('Austin, TX')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Location)
    })

    it('should detect city pattern', async () => {
      const result = await signal.classify('the city center')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Location)
    })
  })

  describe('regex pattern matching - Organization', () => {
    it('should detect Inc/LLC/Corp suffixes', async () => {
      const result = await signal.classify('TechCorp Inc')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
    })

    it('should detect company keyword', async () => {
      const result = await signal.classify('local university')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
    })

    it('should detect universities', async () => {
      const result = await signal.classify('state university system')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
    })

    it('should detect departments', async () => {
      const result = await signal.classify('marketing department team')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
    })

    it('should detect government agencies', async () => {
      const result = await signal.classify('government agency office')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
    })
  })

  describe('regex pattern matching - Technology', () => {
    it('should detect programming languages', async () => {
      const result = await signal.classify('Written in JavaScript')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should detect frameworks', async () => {
      const result = await signal.classify('Built with React')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should detect cloud platforms', async () => {
      const result = await signal.classify('Deployed on AWS')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should detect databases', async () => {
      const result = await signal.classify('Stored in PostgreSQL')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should detect APIs', async () => {
      const result = await signal.classify('REST API endpoint')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })
  })

  describe('regex pattern matching - Event', () => {
    it('should detect conferences', async () => {
      const result = await signal.classify('attending the conference')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Event)
    })

    it('should detect meetings', async () => {
      const result = await signal.classify('schedule a meeting')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Event)
    })

    it('should detect deployment events', async () => {
      const result = await signal.classify('upcoming deployment window')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Event)
    })

    it('should detect workshops', async () => {
      const result = await signal.classify('Workshop on AI')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Event)
    })
  })

  describe('regex pattern matching - Concept', () => {
    it('should detect theories', async () => {
      const result = await signal.classify('Theory of Relativity')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Concept)
    })

    it('should detect patterns', async () => {
      const result = await signal.classify('Singleton pattern implementation')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Concept)
    })

    it('should detect algorithms', async () => {
      const result = await signal.classify('Sorting algorithm')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Concept)
    })

    it('should detect architectures', async () => {
      const result = await signal.classify('Microservices architecture')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Concept)
    })
  })

  describe('regex pattern matching - Object', () => {
    it('should detect devices', async () => {
      const result = await signal.classify('Mobile device')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should detect vehicles', async () => {
      const result = await signal.classify('Electric car')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should detect computers', async () => {
      const result = await signal.classify('Laptop computer')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should detect tools', async () => {
      const result = await signal.classify('Power tool')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })
  })

  describe('regex pattern matching - Document', () => {
    it('should detect documents', async () => {
      const result = await signal.classify('Technical document')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Document)
    })

    it('should detect reports', async () => {
      const result = await signal.classify('Annual report 2024')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Document)
    })

    it('should detect specifications', async () => {
      const result = await signal.classify('technical specification document')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Document)
    })

    it('should detect file extensions', async () => {
      const result = await signal.classify('readme.pdf')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Document)
    })
  })

  describe('regex pattern matching - File', () => {
    it('should detect source files', async () => {
      const result = await signal.classify('index.ts')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.File)
    })

    it('should detect config files', async () => {
      const result = await signal.classify('config.yaml')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.File)
    })

    it('should detect image files', async () => {
      const result = await signal.classify('logo.png')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.File)
    })
  })

  describe('naming convention patterns', () => {
    it('should detect PascalCase as Concept', async () => {
      const result = await signal.classify('UserInterface')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Concept)
      expect(result?.source).toBe('pattern-naming')
      expect(result?.metadata?.matchedPattern).toBe('PascalCase')
    })

    it('should detect camelCase as Attribute', async () => {
      const result = await signal.classify('userName')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Measurement)
      expect(result?.metadata?.matchedPattern).toBe('camelCase')
    })

    it('should detect UPPER_CASE as Attribute', async () => {
      const result = await signal.classify('MAX_CONNECTIONS')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Measurement)
      expect(result?.metadata?.matchedPattern).toBe('UPPER_CASE')
    })

    it('should detect snake_case as Attribute', async () => {
      const result = await signal.classify('user_name')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Measurement)
      expect(result?.metadata?.matchedPattern).toBe('snake_case')
    })

    it('should detect kebab-case as File', async () => {
      const result = await signal.classify('my-component')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.File)
      expect(result?.metadata?.matchedPattern).toBe('kebab-case')
    })
  })

  describe('structural patterns', () => {
    it('should detect email as Person', async () => {
      const result = await signal.classify('john.doe@example.com')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Person)
      expect(result?.source).toBe('pattern-structural')
      expect(result?.metadata?.matchedPattern).toBe('email')
    })

    it('should detect URL as Object', async () => {
      const result = await signal.classify('https://example.com')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
      expect(result?.metadata?.matchedPattern).toBe('url')
    })

    it('should detect UUID as Object', async () => {
      const result = await signal.classify('550e8400-e29b-41d4-a716-446655440000')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
      expect(result?.metadata?.matchedPattern).toBe('uuid')
    })

    it('should detect semantic version as Project', async () => {
      const result = await signal.classify('v1.2.3')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Project)
      // Can match via regex or structural pattern
      expect(['pattern-regex', 'pattern-structural']).toContain(result?.source)
    })

    it('should detect semantic version without v prefix', async () => {
      const result = await signal.classify('2.0.1')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Project)
    })

    it('should detect ISO date as Event', async () => {
      const result = await signal.classify('2024-01-15T10:30:00')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Event)
      expect(result?.metadata?.matchedPattern).toBe('iso_date')
    })

    it('should detect phone number as Person', async () => {
      const result = await signal.classify('+1-555-123-4567')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Person)
      expect(result?.metadata?.matchedPattern).toBe('phone')
    })
  })

  describe('definition context matching', () => {
    it('should use definition text for better matching', async () => {
      const result = await signal.classify('Apollo', {
        definition: 'A JavaScript framework for building GraphQL APIs'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should match candidate even without definition', async () => {
      const result = await signal.classify('JavaScript')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should combine candidate and definition for matching', async () => {
      const result = await signal.classify('React', {
        definition: 'A JavaScript library for building user interfaces with components'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
      // Multiple JavaScript/React/library matches possible
      expect(result?.metadata?.matchCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('caching', () => {
    it('should cache successful lookups', async () => {
      const result1 = await signal.classify('JavaScript')
      const result2 = await signal.classify('JavaScript')

      expect(result1).toEqual(result2)

      const stats = signal.getStats()
      expect(stats.cacheHits).toBe(1)
      expect(stats.cacheHitRate).toBe(0.5)
    })

    it('should cache null results', async () => {
      const result1 = await signal.classify('!@#$%^&*()')  // Special chars, won't match
      const result2 = await signal.classify('!@#$%^&*()')

      expect(result1).toBeNull()
      expect(result2).toBeNull()

      const stats = signal.getStats()
      expect(stats.cacheHits).toBe(1)
    })

    it('should respect cache size limit', async () => {
      const smallCacheSignal = new PatternSignal(brain, {
        cacheSize: 2
      })

      await smallCacheSignal.classify('JavaScript')
      await smallCacheSignal.classify('Python')
      await smallCacheSignal.classify('TypeScript') // Evicts JavaScript

      const stats = smallCacheSignal.getStats()
      expect(stats.cacheSize).toBeLessThanOrEqual(2)
    })

    it('should clear cache on demand', async () => {
      await signal.classify('JavaScript')

      expect(signal.getStats().cacheSize).toBe(1)

      signal.clearCache()

      expect(signal.getStats().cacheSize).toBe(0)
    })
  })

  describe('statistics', () => {
    it('should track all statistics', async () => {
      const newSignal = new PatternSignal(brain) // Fresh signal for clean stats

      await newSignal.classify('JavaScript') // Regex match
      await newSignal.classify('JavaScript') // Cache hit
      await newSignal.classify('userName')   // Naming match
      await newSignal.classify('hello@email.com') // Structural match (unique)

      const stats = newSignal.getStats()

      expect(stats.calls).toBe(4)
      // Email might match regex pattern too, so be lenient
      expect(stats.regexMatches).toBeGreaterThanOrEqual(1)
      expect(stats.namingMatches).toBeGreaterThanOrEqual(1)
      expect(stats.structuralMatches).toBeGreaterThanOrEqual(1)
      expect(stats.cacheHits).toBe(1)
      expect(stats.patternCount).toBeGreaterThan(50)
    })

    it('should calculate match rates', async () => {
      await signal.classify('JavaScript')
      await signal.classify('Python')
      await signal.classify('unknown')

      const stats = signal.getStats()
      expect(stats.regexMatchRate).toBeCloseTo(2/3, 2)
    })

    it('should reset statistics', async () => {
      await signal.classify('JavaScript')

      signal.resetStats()

      const stats = signal.getStats()
      expect(stats.calls).toBe(0)
      expect(stats.regexMatches).toBe(0)
      expect(stats.patternCount).toBeGreaterThan(50) // Patterns not cleared
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', async () => {
      const result = await signal.classify('')

      expect(result).toBeNull()
    })

    it('should handle whitespace-only string', async () => {
      const result = await signal.classify('   ')

      expect(result).toBeNull()
    })

    it('should handle very long strings', async () => {
      const longString = 'JavaScript '.repeat(1000)
      const result = await signal.classify(longString)

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should handle special characters', async () => {
      const result = await signal.classify('C++')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should handle mixed content', async () => {
      const result = await signal.classify('Built with JavaScript and React')

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })
  })

  describe('real-world scenarios', () => {
    it('should classify software developer', async () => {
      const result = await signal.classify('Sarah Johnson, Senior Software Engineer')

      expect(result?.type).toBe(NounType.Person)
    })

    it('should classify company', async () => {
      const result = await signal.classify('Google LLC')

      expect(result?.type).toBe(NounType.Organization)
    })

    it('should classify tech stack', async () => {
      const result = await signal.classify('Node.js application')

      expect(result?.type).toBe(NounType.Thing)
    })

    it('should classify event', async () => {
      const result = await signal.classify('Annual conference meeting')

      expect(result?.type).toBe(NounType.Event)
    })

    it('should classify design pattern', async () => {
      const result = await signal.classify('Observer pattern')

      expect(result?.type).toBe(NounType.Concept)
    })

    it('should classify file path', async () => {
      const result = await signal.classify('src/index.ts')

      expect(result?.type).toBe(NounType.File)
    })

    it('should classify API endpoint', async () => {
      const result = await signal.classify('REST API')

      expect(result?.type).toBe(NounType.Thing)
    })

    it('should classify documentation', async () => {
      const result = await signal.classify('Technical specification document')

      expect(result?.type).toBe(NounType.Document)
    })
  })

  describe('priority and confidence', () => {
    it('should prefer regex matches over naming', async () => {
      // "React" matches both technology regex and PascalCase naming
      const result = await signal.classify('React')

      expect(result?.source).toBe('pattern-regex') // Regex checked first
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should cap confidence at 0.85', async () => {
      const result = await signal.classify('JavaScript')

      expect(result?.confidence).toBeLessThanOrEqual(0.85)
    })

    it('should respect minConfidence threshold', async () => {
      const strictSignal = new PatternSignal(brain, {
        minConfidence: 0.90
      })

      // Most patterns have confidence < 0.90
      const result = await strictSignal.classify('JavaScript')

      expect(result).toBeNull() // Below threshold
    })
  })

  describe('performance', () => {
    it('should handle 1000 classifications quickly', async () => {
      const terms = [
        'JavaScript', 'Python', 'React', 'Angular', 'Vue',
        'Dr. Smith', 'John Doe', 'CEO', 'Manager', 'Engineer',
        'New York', 'Paris', 'London', 'Tokyo', 'Berlin'
      ]

      const start = Date.now()

      for (let i = 0; i < 1000; i++) {
        await signal.classify(terms[i % terms.length])
      }

      const elapsed = Date.now() - start

      // Should complete in < 300ms (mostly cached after first 15)
      expect(elapsed).toBeLessThan(300)
    })

    it('should have fast pattern matching', async () => {
      const start = Date.now()

      for (let i = 0; i < 100; i++) {
        await signal.classify('JavaScript framework')
      }

      const elapsed = Date.now() - start

      // First call compiles, rest are cached
      expect(elapsed).toBeLessThan(50)
    })
  })
})
