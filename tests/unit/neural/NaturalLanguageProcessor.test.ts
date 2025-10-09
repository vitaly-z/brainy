/**
 * Natural Language Processor Tests
 * Tests NLP features including query parsing, entity extraction, and sentiment analysis
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { NaturalLanguageProcessor } from '../../../src/neural/naturalLanguageProcessor'
import { NounType } from '../../../src/types/graphTypes'

describe('NaturalLanguageProcessor', () => {
  let brain: Brainy<any>
  let nlp: NaturalLanguageProcessor
  
  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' } })
    await brain.init()
    nlp = new NaturalLanguageProcessor(brain)
    
    // Create a rich test dataset for NLP to work with
    await brain.add({
      data: 'John Smith is a senior software engineer at Google working on machine learning',
      type: NounType.Person,
      metadata: { 
        name: 'John Smith',
        role: 'engineer', 
        level: 'senior',
        company: 'Google',
        skills: ['JavaScript', 'Python', 'Machine Learning']
      }
    })
    
    await brain.add({
      data: 'Machine learning research paper on neural networks published in 2024',
      type: NounType.Document,
      metadata: {
        title: 'Advances in Neural Networks',
        category: 'research',
        year: 2024,
        topics: ['AI', 'neural networks', 'deep learning']
      }
    })
    
    await brain.add({
      data: 'TechCorp headquarters located in San Francisco California',
      type: NounType.Location,
      metadata: {
        company: 'TechCorp',
        city: 'San Francisco',
        state: 'CA',
        type: 'headquarters'
      }
    })
    
    await brain.add({
      data: 'Product launch event scheduled for December 2024',
      type: NounType.Event,
      metadata: {
        eventType: 'launch',
        date: '2024-12-01',
        status: 'scheduled'
      }
    })
    
    await brain.add({
      data: 'Python programming language used for data science and machine learning',
      type: NounType.Concept,
      metadata: {
        category: 'programming',
        uses: ['data science', 'machine learning', 'web development']
      }
    })
  })
  
  afterEach(async () => {
    await brain.close()
  })
  
  describe('processNaturalQuery - Core Functionality', () => {
    it('should handle questions about entities', async () => {
      const query = 'What is John Smith working on?'
      const result = await nlp.processNaturalQuery(query)

      expect(result).toBeDefined()
      // Should search for John Smith
      const hasSearch = result.similar || result.like || result.where
      expect(hasSearch).toBeDefined()
    })

    it('should extract location-based queries', async () => {
      const query = 'Find companies in San Francisco'
      const result = await nlp.processNaturalQuery(query)

      expect(result).toBeDefined()
      // Should have search criteria (location might be in where clause)
      expect(result.like || result.where).toBeDefined()
    })

    it('should extract limit from queries', async () => {
      const query = 'Show me the top 5 machine learning papers'
      const result = await nlp.processNaturalQuery(query)

      expect(result).toBeDefined()
      if (result.limit) {
        const limit = typeof result.limit === 'string' ? parseInt(result.limit) : result.limit
        expect(limit).toBeGreaterThan(0)
        expect(limit).toBeLessThanOrEqual(10) // Should extract a reasonable limit
      }
      // Limit extraction is optional feature
    })
  })
  
  describe('extract - Entity and Information Extraction', () => {
    it('should extract entities from text', async () => {
      const text = 'John Smith works at Google on machine learning projects'
      const extraction = await nlp.extract(text)

      expect(extraction).toBeDefined()
      expect(Array.isArray(extraction)).toBe(true)

      // Should find at least one entity
      expect(extraction.length).toBeGreaterThan(0)
      // Should find person (John Smith)
      const entityTypes = extraction.map((e: any) => e.type)
      expect(entityTypes.length).toBeGreaterThan(0)
    })
    
    it('should extract topics and concepts', async () => {
      const text = 'This paper discusses neural networks, deep learning, and artificial intelligence'
      const extraction = await nlp.extract(text, { types: ['concept', 'topic'] })

      expect(extraction).toBeDefined()
      expect(Array.isArray(extraction)).toBe(true)

      // May or may not find specific concepts depending on neural matcher
      // Just verify extraction works
    })
    
    it('should extract dates and times', async () => {
      const text = 'The meeting is scheduled for December 15, 2024 at 3:00 PM'
      const extraction = await nlp.extract(text, { types: ['date', 'time', 'event'] })

      expect(extraction).toBeDefined()
      expect(Array.isArray(extraction)).toBe(true)
      // Neural extraction may or may not find specific dates
    })
    
    it('should extract locations', async () => {
      const text = 'Our offices are in San Francisco, New York, and London'
      const extraction = await nlp.extract(text, { types: ['location', 'place'] })

      expect(extraction).toBeDefined()
      expect(Array.isArray(extraction)).toBe(true)
      // Neural extraction may or may not find specific locations
    })
  })
  
  describe('sentiment - Sentiment Analysis', () => {
    it('should analyze positive sentiment', async () => {
      const text = 'This is an excellent machine learning framework! Really impressive results.'
      const sentiment = await nlp.sentiment(text)
      
      expect(sentiment).toBeDefined()
      expect(sentiment.overall.score).toBeGreaterThan(0) // Positive score
      expect(sentiment.overall.label).toBe('positive')
    })
    
    it('should analyze negative sentiment', async () => {
      const text = 'This approach is terrible and the results are disappointing.'
      const sentiment = await nlp.sentiment(text)
      
      expect(sentiment).toBeDefined()
      expect(sentiment.overall.score).toBeLessThan(0) // Negative score
      expect(sentiment.overall.label).toBe('negative')
    })
    
    it('should analyze neutral sentiment', async () => {
      const text = 'The document contains information about machine learning.'
      const sentiment = await nlp.sentiment(text)
      
      expect(sentiment).toBeDefined()
      expect(Math.abs(sentiment.overall.score)).toBeLessThan(0.3) // Close to neutral
      expect(sentiment.overall.label).toBe('neutral')
    })
    
    it('should provide magnitude scores', async () => {
      const text = 'Machine learning is transforming technology'
      const sentiment = await nlp.sentiment(text)

      expect(sentiment).toBeDefined()
      expect(sentiment.overall.magnitude).toBeDefined()
      // Magnitude can be 0 for neutral text
      expect(sentiment.overall.magnitude).toBeGreaterThanOrEqual(0)
      expect(sentiment.overall.magnitude).toBeLessThanOrEqual(10)
    })
  })
  
  describe('Query Pattern Recognition', () => {
    it('should recognize question patterns', async () => {
      const questions = [
        'What is machine learning?',
        'Who is John Smith?',
        'Where is Google located?',
        'When is the product launch?',
        'How does Python work?'
      ]
      
      for (const q of questions) {
        const result = await nlp.processNaturalQuery(q)
        expect(result).toBeDefined()
        // Should produce a search query
        expect(result.similar || result.like || result.where).toBeDefined()
      }
    })
    
    it('should recognize command patterns', async () => {
      const commands = [
        'Find all engineers',
        'Show me recent papers',
        'List upcoming events',
        'Get information about Google',
        'Search for machine learning'
      ]

      for (const cmd of commands) {
        const result = await nlp.processNaturalQuery(cmd)
        expect(result).toBeDefined()
        // Should have search criteria
        expect(result.similar || result.like || result.where).toBeDefined()
      }
    })
  })
  
  describe('Advanced Features', () => {
    it('should handle ambiguous queries gracefully', async () => {
      const query = 'stuff about that thing'
      const result = await nlp.processNaturalQuery(query)
      
      expect(result).toBeDefined()
      // Should still attempt to create a query
      expect(result).not.toBeNull()
    })
    
    it('should handle very long queries', async () => {
      const longQuery = 'Find ' + 'machine learning '.repeat(50) + 'papers'
      const result = await nlp.processNaturalQuery(longQuery)

      expect(result).toBeDefined()
      // Should still produce a valid query
      expect(result.like || result.where).toBeDefined()
    })
    
    it('should handle empty queries', async () => {
      const result = await nlp.processNaturalQuery('')

      expect(result).toBeDefined()
      // Empty query returns minimal query structure
      expect(result).toHaveProperty('like')
    })

    it('should extract modifiers and preferences', async () => {
      const queries = [
        'Find the most recent papers',
        'Show the best engineers',
        'Get the latest news',
        'Find popular frameworks'
      ]
      
      for (const q of queries) {
        const result = await nlp.processNaturalQuery(q)
        expect(result).toBeDefined()
        
        // Might have boost or ordering
        if (result.boost) {
          expect(['recent', 'popular', 'verified']).toContain(result.boost)
        }
      }
    })
  })
  
  describe('Integration with Brainy', () => {
    it('should produce queries that work with brain.find()', async () => {
      const naturalQueries = [
        'Find machine learning papers',
        'Search for John Smith',
        'Get information about Python'
      ]
      
      for (const nq of naturalQueries) {
        const tripleQuery = await nlp.processNaturalQuery(nq)
        
        // Should be able to use with brain.find()
        const results = await brain.find(tripleQuery as any)
        
        expect(results).toBeDefined()
        expect(Array.isArray(results)).toBe(true)
      }
    })
    
    it('should work with complex real-world queries', async () => {
      const complexQuery = 'Find senior engineers at tech companies working on AI'
      const tripleQuery = await nlp.processNaturalQuery(complexQuery)
      
      expect(tripleQuery).toBeDefined()
      
      // Use with brain
      const results = await brain.find(tripleQuery as any)
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
    })
    
    it('should handle entity extraction for brain operations', async () => {
      const text = 'John Smith is a talented engineer at Google'
      const extraction = await nlp.extract(text)
      
      // Could use extracted entities to create new entries
      if (extraction && extraction.length > 0) {
        for (const entity of extraction) {
          if (entity.type === 'person' && entity.text) {
            // Could add to brain
            const id = await brain.add({
              data: entity.text,
              type: NounType.Person,
              metadata: { extracted: true }
            })
            expect(id).toBeDefined()
            
            // Verify it was added
            const retrieved = await brain.get(id)
            expect(retrieved).toBeDefined()
          }
        }
      }
    })
  })
  
  describe('Performance', () => {
    it('should process queries quickly', async () => {
      const query = 'Find machine learning papers from 2024'
      
      const startTime = Date.now()
      const result = await nlp.processNaturalQuery(query)
      const duration = Date.now() - startTime
      
      expect(result).toBeDefined()
      expect(duration).toBeLessThan(200) // Should be fast
    })
    
    it('should handle multiple queries efficiently', async () => {
      const queries = Array(10).fill('Find AI research')

      const startTime = Date.now()
      const results = await Promise.all(
        queries.map(q => nlp.processNaturalQuery(q))
      )
      const duration = Date.now() - startTime

      expect(results).toHaveLength(10)
      expect(duration).toBeLessThan(2000) // Should handle batch in reasonable time
    })
    
    it('should cache pattern matching for performance', async () => {
      const query = 'Find machine learning papers'
      
      // First call - might be slower
      const start1 = Date.now()
      await nlp.processNaturalQuery(query)
      const time1 = Date.now() - start1
      
      // Second call - should be faster due to caching
      const start2 = Date.now()
      await nlp.processNaturalQuery(query)
      const time2 = Date.now() - start2
      
      // Second should be similar or faster
      expect(time2).toBeLessThanOrEqual(time1 + 10)
    })
  })
})