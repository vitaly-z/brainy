import { describe, it, expect, beforeEach } from 'vitest'
import { BrainyData } from '../src/brainyData.js'
import { matchesMetadataFilter } from '../src/utils/metadataFilter.js'

describe('Metadata Filtering', () => {
  let brainy: BrainyData

  beforeEach(async () => {
    brainy = new BrainyData({
      storage: { forceMemoryStorage: true },
      hnsw: { M: 8, efConstruction: 50 },
      logging: { verbose: false }
    })
    await brainy.init()
    console.log('BrainyData initialized')
  })

  describe('matchesMetadataFilter', () => {
    it('should match simple equality filters', () => {
      const metadata = { level: 'senior', location: 'SF' }
      
      expect(matchesMetadataFilter(metadata, { level: 'senior' })).toBe(true)
      expect(matchesMetadataFilter(metadata, { level: 'junior' })).toBe(false)
      expect(matchesMetadataFilter(metadata, { level: 'senior', location: 'SF' })).toBe(true)
      expect(matchesMetadataFilter(metadata, { level: 'senior', location: 'NYC' })).toBe(false)
    })

    it('should support Brain Pattern operators', () => {
      const metadata = { age: 30, skills: ['React', 'Vue'], name: 'John' }
      
      // greaterThan, greaterEqual, lessThan, lessEqual
      expect(matchesMetadataFilter(metadata, { age: { greaterThan: 25 } })).toBe(true)
      expect(matchesMetadataFilter(metadata, { age: { lessThan: 25 } })).toBe(false)
      expect(matchesMetadataFilter(metadata, { age: { greaterEqual: 30 } })).toBe(true)
      expect(matchesMetadataFilter(metadata, { age: { lessEqual: 30 } })).toBe(true)
      
      // oneOf, noneOf
      expect(matchesMetadataFilter(metadata, { age: { oneOf: [25, 30, 35] } })).toBe(true)
      expect(matchesMetadataFilter(metadata, { age: { noneOf: [25, 35] } })).toBe(true)
      expect(matchesMetadataFilter(metadata, { age: { noneOf: [30] } })).toBe(false)
      
      // contains for arrays
      expect(matchesMetadataFilter(metadata, { skills: { contains: 'React' } })).toBe(true)
      expect(matchesMetadataFilter(metadata, { skills: { contains: 'Angular' } })).toBe(false)
      
      // matches (regex)
      expect(matchesMetadataFilter(metadata, { name: { matches: '^Jo' } })).toBe(true)
      expect(matchesMetadataFilter(metadata, { name: { matches: 'hn$' } })).toBe(true)
      expect(matchesMetadataFilter(metadata, { name: { matches: 'Jane' } })).toBe(false)
    })

    it('should support nested fields with dot notation', () => {
      const metadata = {
        user: {
          profile: {
            level: 'senior',
            skills: ['React', 'TypeScript']
          }
        }
      }
      
      expect(matchesMetadataFilter(metadata, { 'user.profile.level': 'senior' })).toBe(true)
      expect(matchesMetadataFilter(metadata, { 'user.profile.level': 'junior' })).toBe(false)
      expect(matchesMetadataFilter(metadata, { 
        'user.profile.skills': { contains: 'React' } 
      })).toBe(true)
    })

    it('should support logical operators', () => {
      const metadata = { level: 'senior', location: 'SF', remote: true }
      
      // allOf (AND logic)
      expect(matchesMetadataFilter(metadata, {
        allOf: [
          { level: 'senior' },
          { location: 'SF' }
        ]
      })).toBe(true)
      
      expect(matchesMetadataFilter(metadata, {
        allOf: [
          { level: 'senior' },
          { location: 'NYC' }
        ]
      })).toBe(false)
      
      // anyOf (OR logic)
      expect(matchesMetadataFilter(metadata, {
        anyOf: [
          { location: 'NYC' },
          { location: 'SF' }
        ]
      })).toBe(true)
      
      expect(matchesMetadataFilter(metadata, {
        anyOf: [
          { location: 'NYC' },
          { location: 'LA' }
        ]
      })).toBe(false)
      
      // not
      expect(matchesMetadataFilter(metadata, {
        not: { location: 'NYC' }
      })).toBe(true)
      
      expect(matchesMetadataFilter(metadata, {
        not: { location: 'SF' }
      })).toBe(false)
    })
  })

  describe('Search with metadata filtering', () => {
    beforeEach(async () => {
      // Add test data
      const developers = [
        { name: 'Alice', level: 'senior', skills: ['React', 'TypeScript'], location: 'SF', available: true },
        { name: 'Bob', level: 'mid', skills: ['Vue', 'JavaScript'], location: 'NYC', available: true },
        { name: 'Charlie', level: 'senior', skills: ['React', 'Python'], location: 'SF', available: false },
        { name: 'David', level: 'junior', skills: ['JavaScript'], location: 'LA', available: true },
        { name: 'Eve', level: 'senior', skills: ['Angular', 'TypeScript'], location: 'NYC', available: true }
      ]
      
      for (const dev of developers) {
        await brainy.add(
          `${dev.name} is a ${dev.level} developer with ${dev.skills.join(', ')} skills in ${dev.location}`,
          dev
        )
      }
    })

    it('should filter by simple metadata fields', async () => {
      // First check what we have without filter
      const allResults = await brainy.searchText('developer', 10)
      console.log('All results:', allResults.map(r => ({ 
        id: r.id.substring(0, 8), 
        level: r.metadata?.level,
        name: r.metadata?.name 
      })))
      
      // Now with filter
      const results = await brainy.searchText('developer', 10, {
        metadata: { level: 'senior' }
      })
      
      console.log('Filtered results:', results.map(r => ({ 
        id: r.id.substring(0, 8), 
        level: r.metadata?.level,
        name: r.metadata?.name 
      })))
      
      expect(results.length).toBeGreaterThan(0)
      expect(results.every(r => r.metadata?.level === 'senior')).toBe(true)
    })

    it('should filter by multiple metadata fields', async () => {
      const results = await brainy.searchText('developer', 10, {
        metadata: { 
          level: 'senior',
          location: 'SF'
        }
      })
      
      expect(results.length).toBeGreaterThan(0)
      expect(results.every(r => 
        r.metadata?.level === 'senior' && 
        r.metadata?.location === 'SF'
      )).toBe(true)
    })

    it('should filter with Brainy Field Operators', async () => {
      // First verify what we have in the index
      const allResults = await brainy.searchText('developer', 10)
      console.log('All results before filtering:', allResults.map(r => ({
        name: r.metadata?.name,
        skills: r.metadata?.skills,
        available: r.metadata?.available
      })))
      
      const results = await brainy.searchText('developer', 10, {
        metadata: {
          skills: { contains: 'React' },
          available: true
        }
      })
      
      console.log('Filtered results:', results.map(r => ({
        name: r.metadata?.name,
        skills: r.metadata?.skills,
        available: r.metadata?.available
      })))
      
      expect(results.length).toBeGreaterThan(0)
      
      // Check each result individually for debugging
      for (const r of results) {
        const hasReact = r.metadata?.skills?.includes('React')
        const isAvailable = r.metadata?.available === true
        if (!hasReact || !isAvailable) {
          console.log('Failed result:', r.metadata)
        }
      }
      
      expect(results.every(r => 
        r.metadata?.skills?.includes('React') && 
        r.metadata?.available === true
      )).toBe(true)
    })

    it('should filter with complex queries', async () => {
      const results = await brainy.searchText('developer', 10, {
        metadata: {
          anyOf: [
            { location: 'SF' },
            { location: 'NYC' }
          ],
          level: { oneOf: ['senior', 'mid'] }
        }
      })
      
      expect(results.length).toBeGreaterThan(0)
      expect(results.every(r => {
        const m = r.metadata
        return (m?.location === 'SF' || m?.location === 'NYC') &&
               (m?.level === 'senior' || m?.level === 'mid')
      })).toBe(true)
    })
  })

  describe('searchWithinItems', () => {
    let itemIds: string[] = []
    
    beforeEach(async () => {
      // Add test data and collect IDs
      const items = [
        { content: 'JavaScript programming', category: 'tech' },
        { content: 'TypeScript development', category: 'tech' },
        { content: 'Python data science', category: 'tech' },
        { content: 'React components', category: 'frontend' },
        { content: 'Vue templates', category: 'frontend' }
      ]
      
      for (const item of items) {
        const id = await brainy.add(item.content, item)
        if (item.category === 'frontend') {
          itemIds.push(id)
        }
      }
    })

    it('should search only within specified items', async () => {
      // Search within frontend items only
      const results = await brainy.searchWithinItems('JavaScript', itemIds, 5)
      
      expect(results.length).toBeLessThanOrEqual(itemIds.length)
      expect(results.every(r => itemIds.includes(r.id))).toBe(true)
    })

    it('should return empty results if no items match', async () => {
      const results = await brainy.searchWithinItems('JavaScript', [], 5)
      expect(results).toEqual([])
    })

    it('should limit results to k even if more items are provided', async () => {
      const results = await brainy.searchWithinItems('development', itemIds, 1)
      expect(results.length).toBe(1)
    })
  })
})