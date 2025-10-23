import { describe, it, expect, beforeEach } from 'vitest'
import { ContextSignal } from '../../../../src/neural/signals/ContextSignal.js'
import { NounType } from '../../../../src/types/graphTypes.js'
import type { Brainy } from '../../../../src/brainy.js'

// Mock brain instance
const mockBrain = {
  embed: async (text: string) => {
    return new Array(384).fill(0)
  }
} as unknown as Brainy

describe('ContextSignal', () => {
  let signal: ContextSignal

  beforeEach(() => {
    signal = new ContextSignal(mockBrain)
  })

  describe('initialization', () => {
    it('should initialize with default options', () => {
      const signal = new ContextSignal(mockBrain)
      const stats = signal.getStats()

      expect(stats.calls).toBe(0)
      expect(stats.cacheHits).toBe(0)
    })

    it('should initialize with custom options', () => {
      const signal = new ContextSignal(mockBrain, {
        minConfidence: 0.70,
        timeout: 100,
        cacheSize: 1000
      })

      const stats = signal.getStats()
      expect(stats.calls).toBe(0)
    })

    it('should precompile relationship patterns', () => {
      const signal = new ContextSignal(mockBrain)
      const patternCount = signal.getPatternCount()

      expect(patternCount).toBeGreaterThan(40)
    })
  })

  describe('relationship patterns - Person', () => {
    it('should detect CEO of organization', async () => {
      const result = await signal.classify('TechCorp', {
        definition: 'John Smith is the CEO of TechCorp'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
      expect(result?.confidence).toBeGreaterThan(0.50)
      expect(result?.source).toBe('context-relationship')
    })

    it('should detect employee of organization', async () => {
      const result = await signal.classify('Acme Inc', {
        definition: 'Jane is an employee of Acme Inc'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
    })

    it('should detect lives in location', async () => {
      const result = await signal.classify('Seattle', {
        definition: 'Bob lives in Seattle'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Location)
      expect(result?.confidence).toBeGreaterThan(0.70)
    })

    it('should detect born in location', async () => {
      const result = await signal.classify('Chicago', {
        definition: 'She was born in Chicago'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Location)
    })

    it('should detect uses technology', async () => {
      const result = await signal.classify('React', {
        definition: 'The developer uses React for frontend development'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should detect attended event', async () => {
      const result = await signal.classify('DevConf 2024', {
        definition: 'Sarah attended DevConf 2024 last month'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Event)
    })

    it('should detect understands concept', async () => {
      const result = await signal.classify('quantum mechanics', {
        definition: 'The physicist understands quantum mechanics deeply'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Concept)
    })

    it('should detect owns object', async () => {
      const result = await signal.classify('laptop', {
        definition: 'Alex owns a laptop for work'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })
  })

  describe('relationship patterns - Organization', () => {
    it('should detect subsidiary of organization', async () => {
      const result = await signal.classify('Microsoft', {
        definition: 'GitHub is a subsidiary of Microsoft'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
      expect(result?.confidence).toBeGreaterThan(0.70)
    })

    it('should detect partner of organization', async () => {
      const result = await signal.classify('Salesforce', {
        definition: 'Slack is a partner of Salesforce'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
    })

    it('should detect office in location', async () => {
      const result = await signal.classify('Austin', {
        definition: 'The company has an office in Austin'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Location)
    })

    it('should detect acquired organization', async () => {
      const result = await signal.classify('Instagram', {
        definition: 'Facebook acquired Instagram in 2012'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
    })

    it('should detect implements technology', async () => {
      const result = await signal.classify('Kubernetes', {
        definition: 'The enterprise implements Kubernetes for container orchestration'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should detect hosted event', async () => {
      const result = await signal.classify('Summit 2024', {
        definition: 'Google organized Summit 2024 in May'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Event)
    })
  })

  describe('relationship patterns - Location', () => {
    it('should detect capital of location', async () => {
      const result = await signal.classify('France', {
        definition: 'Paris is the capital of France'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Location)
      expect(result?.confidence).toBeGreaterThan(0.80)
    })

    it('should detect near location', async () => {
      const result = await signal.classify('Portland', {
        definition: 'Seattle is near Portland in the Pacific Northwest'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Location)
    })

    it('should detect directional relationship', async () => {
      const result = await signal.classify('Canada', {
        definition: 'Detroit is located south of Canada'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Location)
    })

    it('should detect located in relationship', async () => {
      const result = await signal.classify('California', {
        definition: 'San Francisco is located in California'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Location)
    })
  })

  describe('relationship patterns - Technology', () => {
    it('should detect built with technology', async () => {
      const result = await signal.classify('Python', {
        definition: 'The application is built with Python and Django'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should detect powered by technology', async () => {
      const result = await signal.classify('Node.js', {
        definition: 'The backend is powered by Node.js runtime'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should detect integrated with technology', async () => {
      const result = await signal.classify('Stripe', {
        definition: 'Payment system integrated with Stripe API'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Interface)
    })

    it('should detect deployed on service', async () => {
      const result = await signal.classify('AWS', {
        definition: 'The infrastructure is deployed on AWS cloud'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Service)
    })

    it('should detect developed by organization', async () => {
      const result = await signal.classify('Facebook', {
        definition: 'React was developed by Facebook engineering team'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
    })

    it('should detect API for technology', async () => {
      const result = await signal.classify('PostgreSQL', {
        definition: 'We provide an API for PostgreSQL database access'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Interface)
    })
  })

  describe('relationship patterns - Event', () => {
    it('should detect temporal before relationship', async () => {
      const result = await signal.classify('World War II', {
        definition: 'The Great Depression occurred before World War II'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Event)
    })

    it('should detect scheduled event', async () => {
      const result = await signal.classify('annual meeting', {
        definition: 'The quarterly review is scheduled for annual meeting'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Event)
    })

    it('should detect keynote at event', async () => {
      const result = await signal.classify('WWDC', {
        definition: 'Tim Cook delivered the keynote at WWDC'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Event)
      expect(result?.confidence).toBeGreaterThan(0.70)
    })

    it('should detect registration for event', async () => {
      const result = await signal.classify('conference', {
        definition: 'Early bird registration for conference ends soon'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Event)
    })
  })

  describe('relationship patterns - Concept', () => {
    it('should detect theory of concept', async () => {
      const result = await signal.classify('relativity', {
        definition: 'Einstein proposed the theory of relativity'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Concept)
    })

    it('should detect based on concept', async () => {
      const result = await signal.classify('object-oriented programming', {
        definition: 'The design is based on object-oriented programming principles'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Concept)
    })

    it('should detect example of concept', async () => {
      const result = await signal.classify('polymorphism', {
        definition: 'Method overriding is an example of polymorphism'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Concept)
    })

    it('should detect methodology for process', async () => {
      const result = await signal.classify('software development', {
        definition: 'Agile is a methodology for software development'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Process)
    })
  })

  describe('relationship patterns - Object', () => {
    it('should detect made of material', async () => {
      const result = await signal.classify('steel', {
        definition: 'The bridge is made of steel and concrete'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should detect part of object', async () => {
      const result = await signal.classify('car', {
        definition: 'The engine is a part of car assembly'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should detect physical measurement', async () => {
      const result = await signal.classify('package', {
        definition: 'The shipping container weighs package at 50kg'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })
  })

  describe('relationship patterns - Document', () => {
    it('should detect chapter in document', async () => {
      const result = await signal.classify('manual', {
        definition: 'Chapter 5 is a section in manual for beginners'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Document)
    })

    it('should detect author of document', async () => {
      const result = await signal.classify('thesis', {
        definition: 'Dr. Smith wrote thesis on machine learning'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Document)
    })

    it('should detect reference to document', async () => {
      const result = await signal.classify('paper', {
        definition: 'The study includes a reference to paper published in 2020'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Document)
    })
  })

  describe('relationship patterns - Project', () => {
    it('should detect milestone in project', async () => {
      const result = await signal.classify('Apollo program', {
        definition: 'Moon landing was a milestone in Apollo program'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Project)
    })

    it('should detect deliverable for project', async () => {
      const result = await signal.classify('website redesign', {
        definition: 'The mockups are a deliverable for website redesign'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Project)
    })

    it('should detect working on project', async () => {
      const result = await signal.classify('mobile app', {
        definition: 'The team is working on mobile app development'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Project)
    })
  })

  describe('attribute patterns', () => {
    it('should detect speed attribute for object', async () => {
      const result = await signal.classify('car', {
        definition: 'This is a fast car with turbocharged engine'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
      expect(result?.source).toBe('context-attribute')
    })

    it('should detect size attribute for object', async () => {
      const result = await signal.classify('building', {
        definition: 'The massive building dominates the skyline'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should detect price attribute for object', async () => {
      const result = await signal.classify('watch', {
        definition: 'An expensive watch made in Switzerland'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should detect frequency attribute for event', async () => {
      const result = await signal.classify('meeting', {
        definition: 'Our weekly meeting is scheduled for Monday'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Event)
    })
  })

  describe('combined matching', () => {
    it('should prefer relationship over attribute matches', async () => {
      const result = await signal.classify('conference', {
        definition: 'An expensive annual conference that she attended last year'
      })

      expect(result).toBeDefined()
      // Should match "attended X" (relationship) not "annual X" (attribute)
      expect(result?.type).toBe(NounType.Event)
    })

    it('should handle multiple relationship patterns', async () => {
      const result = await signal.classify('company', {
        definition: 'John is CEO of company and it has an office in Seattle'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
    })

    it('should use highest confidence when multiple matches', async () => {
      const result = await signal.classify('NYC', {
        definition: 'She lives in NYC, which is the largest city of New York state'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Location)
      // Should use higher confidence match
      expect(result?.confidence).toBeGreaterThan(0.65)
    })
  })

  describe('caching', () => {
    it('should cache successful lookups', async () => {
      const result1 = await signal.classify('Seattle', {
        definition: 'Bob lives in Seattle'
      })
      const result2 = await signal.classify('Seattle', {
        definition: 'Bob lives in Seattle'
      })

      expect(result1).toEqual(result2)

      const stats = signal.getStats()
      expect(stats.cacheHits).toBe(1)
    })

    it('should cache null results', async () => {
      const result1 = await signal.classify('unknown', {
        definition: 'This has no context patterns'
      })
      const result2 = await signal.classify('unknown', {
        definition: 'This has no context patterns'
      })

      expect(result1).toBeNull()
      expect(result2).toBeNull()

      const stats = signal.getStats()
      expect(stats.cacheHits).toBe(1)
    })

    it('should respect cache size limit', async () => {
      const signal = new ContextSignal(mockBrain, { cacheSize: 10 })

      // Add 15 items to cache
      for (let i = 0; i < 15; i++) {
        await signal.classify(`entity${i}`, {
          definition: `Person lives in entity${i}`
        })
      }

      const stats = signal.getStats()
      expect(stats.cacheSize).toBeLessThanOrEqual(10)
    })

    it('should clear cache on demand', async () => {
      await signal.classify('Seattle', {
        definition: 'Lives in Seattle'
      })

      signal.clearCache()

      const stats = signal.getStats()
      expect(stats.cacheSize).toBe(0)
    })
  })

  describe('statistics', () => {
    it('should track all statistics', async () => {
      signal.resetStats()

      await signal.classify('Seattle', { definition: 'Lives in Seattle' })
      await signal.classify('laptop', { definition: 'A fast laptop for gaming' })
      await signal.classify('unknown', { definition: 'No patterns here' })

      const stats = signal.getStats()
      expect(stats.calls).toBe(3)
      expect(stats.relationshipMatches).toBeGreaterThanOrEqual(1)
      expect(stats.attributeMatches).toBeGreaterThanOrEqual(0)
    })

    it('should calculate match rates', async () => {
      signal.resetStats()

      await signal.classify('Seattle', { definition: 'Lives in Seattle' })
      await signal.classify('Portland', { definition: 'Lives in Portland' })

      const stats = signal.getStats()
      expect(stats.relationshipMatchRate).toBeGreaterThan(0)
      expect(stats.relationshipMatchRate).toBeLessThanOrEqual(1)
    })

    it('should reset statistics', () => {
      signal.resetStats()

      const stats = signal.getStats()
      expect(stats.calls).toBe(0)
      expect(stats.cacheHits).toBe(0)
      expect(stats.relationshipMatches).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should return null without context', async () => {
      const result = await signal.classify('Seattle')

      expect(result).toBeNull()
    })

    it('should handle empty definition', async () => {
      const result = await signal.classify('Seattle', {
        definition: ''
      })

      expect(result).toBeNull()
    })

    it('should handle definition without patterns', async () => {
      const result = await signal.classify('something', {
        definition: 'This text has no relationship patterns'
      })

      expect(result).toBeNull()
    })

    it('should handle special characters in candidate', async () => {
      const result = await signal.classify('C++', {
        definition: 'The application is built with C++'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should handle very long definitions', async () => {
      const longDef = 'A'.repeat(5000) + ' CEO of company ' + 'B'.repeat(5000)
      const result = await signal.classify('company', {
        definition: longDef
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
    })

    it('should handle case-insensitive matching', async () => {
      const result = await signal.classify('SEATTLE', {
        definition: 'Bob LIVES IN SEATTLE'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Location)
    })
  })

  describe('real-world scenarios', () => {
    it('should classify company from employee context', async () => {
      const result = await signal.classify('Google', {
        definition: 'Sarah Johnson is a senior software engineer at Google, working on search algorithms'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
    })

    it('should classify city from residence', async () => {
      const result = await signal.classify('Tokyo', {
        definition: 'Yuki Tanaka lives in Tokyo and commutes to work daily'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Location)
    })

    it('should classify technology from usage', async () => {
      const result = await signal.classify('Docker', {
        definition: 'The development team uses Docker for containerizing microservices'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Thing)
    })

    it('should classify event from attendance', async () => {
      const result = await signal.classify('React Conf', {
        definition: 'Maria spoke at React Conf about performance optimization techniques'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Event)
    })

    it('should classify concept from theory', async () => {
      const result = await signal.classify('quantum entanglement', {
        definition: 'The principle of quantum entanglement explains action at a distance'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Concept)
    })

    it('should classify document from authorship', async () => {
      const result = await signal.classify('research paper', {
        definition: 'Dr. Lee published research paper on climate change impacts'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Document)
    })

    it('should classify project from participation', async () => {
      const result = await signal.classify('Mars mission', {
        definition: 'NASA engineers are working on Mars mission launch preparations'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Project)
    })

    it('should classify subsidiary organization', async () => {
      const result = await signal.classify('Amazon', {
        definition: 'AWS is a major division of Amazon providing cloud services'
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
    })
  })

  describe('context with allTerms', () => {
    it('should use allTerms when definition is not provided', async () => {
      const result = await signal.classify('Seattle', {
        allTerms: ['Bob', 'lives', 'in', 'Seattle', 'Washington']
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Location)
    })

    it('should combine definition and allTerms', async () => {
      const result = await signal.classify('company', {
        definition: 'John works at company',
        allTerms: ['CEO', 'of', 'company']
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(NounType.Organization)
    })
  })
})
