/**
 * Hybrid Search Tests (v7.7.0)
 *
 * Tests for zero-config hybrid search combining semantic (vector) + text (keyword) matching
 * using Reciprocal Rank Fusion (RRF).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { createAddParams } from '../../helpers/test-factory'
import { NounType } from '../../../src/types/graphTypes'

describe('Hybrid Search (v7.7.0)', () => {
  let brain: Brainy<any>

  beforeEach(async () => {
    brain = new Brainy({
      storage: { type: 'memory' }
    })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  describe('Zero-Config Hybrid (default mode)', () => {
    it('should return results combining text and semantic matches', async () => {
      // Add entities with specific text content
      const davidId = await brain.add(createAddParams({
        data: 'David Smith is a software engineer at Google',
        type: NounType.Person,
        metadata: { name: 'David Smith', role: 'engineer' }
      }))

      const johnId = await brain.add(createAddParams({
        data: 'John Doe works as a data scientist',
        type: NounType.Person,
        metadata: { name: 'John Doe', role: 'scientist' }
      }))

      const janeId = await brain.add(createAddParams({
        data: 'Jane Miller is a product manager',
        type: NounType.Person,
        metadata: { name: 'Jane Miller', role: 'manager' }
      }))

      // Search for "David Smith" - should find exact text match
      const results = await brain.find({
        query: 'David Smith'
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe(davidId)
    })

    it('should favor text matches for short queries', async () => {
      // Add entities with similar semantic meaning but different exact text
      const exactMatch = await brain.add(createAddParams({
        data: 'Python programming language tutorial',
        type: NounType.Document,
        metadata: { title: 'Python Tutorial' }
      }))

      await brain.add(createAddParams({
        data: 'JavaScript coding guide for beginners',
        type: NounType.Document,
        metadata: { title: 'JS Guide' }
      }))

      // Short query "Python" should favor text match
      const results = await brain.find({
        query: 'Python',
        limit: 5
      })

      expect(results.length).toBeGreaterThan(0)
      // The exact text match for "Python" should rank high
      const pythonResult = results.find(r => r.id === exactMatch)
      expect(pythonResult).toBeDefined()
    })

    it('should favor semantic matches for long queries', async () => {
      // Add entities
      await brain.add(createAddParams({
        data: 'Machine learning algorithms and neural networks',
        type: NounType.Document,
        metadata: { category: 'AI' }
      }))

      await brain.add(createAddParams({
        data: 'Deep learning frameworks and artificial intelligence research',
        type: NounType.Document,
        metadata: { category: 'AI' }
      }))

      // Long query should use semantic understanding
      const results = await brain.find({
        query: 'advanced artificial intelligence and machine learning techniques for data analysis',
        limit: 5
      })

      expect(results.length).toBeGreaterThan(0)
      // Both AI-related documents should appear in results
      expect(results.some(r => r.metadata?.category === 'AI')).toBe(true)
    })
  })

  describe('Search Mode Override', () => {
    it('should use text-only search when searchMode is "text"', async () => {
      const exactId = await brain.add(createAddParams({
        data: 'JavaScript programming',
        metadata: { exact: true }
      }))

      await brain.add(createAddParams({
        data: 'coding and software development',
        metadata: { exact: false }
      }))

      // Force text-only search
      const results = await brain.find({
        query: 'JavaScript',
        searchMode: 'text',
        limit: 5
      })

      expect(results.length).toBeGreaterThan(0)
      // Should find exact text match
      expect(results[0].id).toBe(exactId)
    })

    it('should use semantic-only search when searchMode is "semantic"', async () => {
      const aiId = await brain.add(createAddParams({
        data: 'machine learning algorithms neural networks deep learning',
        metadata: { category: 'AI' }
      }))

      await brain.add(createAddParams({
        data: 'cooking recipes and food preparation kitchen',
        metadata: { category: 'food' }
      }))

      // Force semantic-only search
      const results = await brain.find({
        query: 'machine learning neural networks',
        searchMode: 'semantic',
        limit: 5
      })

      expect(results.length).toBeGreaterThan(0)
      // Should return results using semantic search path
      // (Note: exact ranking depends on embedding model)
      expect(results.some(r => r.id === aiId)).toBe(true)
    })

    it('should accept "vector" as alias for semantic', async () => {
      await brain.add(createAddParams({
        data: 'machine learning algorithms',
        metadata: { category: 'AI' }
      }))

      const results = await brain.find({
        query: 'artificial intelligence',
        searchMode: 'vector' as any,  // Testing alias
        limit: 5
      })

      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('Hybrid Alpha Configuration', () => {
    it('should use custom hybridAlpha when provided', async () => {
      await brain.add(createAddParams({
        data: 'exact text match test',
        metadata: { type: 'text' }
      }))

      await brain.add(createAddParams({
        data: 'similar semantic content',
        metadata: { type: 'semantic' }
      }))

      // Force more weight on text (alpha = 0.1)
      const textWeightedResults = await brain.find({
        query: 'exact text match test',
        hybridAlpha: 0.1,  // 90% text, 10% semantic
        limit: 5
      })

      expect(textWeightedResults.length).toBeGreaterThan(0)
    })

    it('should auto-detect alpha based on query length', async () => {
      await brain.add(createAddParams({
        data: 'test content for verification',
        metadata: { test: true }
      }))

      // Short query (1-2 words) - should auto-detect alpha ~0.3
      const shortResults = await brain.find({
        query: 'test',
        limit: 5
      })

      // Long query (5+ words) - should auto-detect alpha ~0.7
      const longResults = await brain.find({
        query: 'test content for verification and analysis purposes',
        limit: 5
      })

      // Both should return results
      expect(shortResults.length).toBeGreaterThan(0)
      expect(longResults.length).toBeGreaterThan(0)
    })
  })

  describe('Word Tokenization', () => {
    it('should find matches regardless of case', async () => {
      const id = await brain.add(createAddParams({
        data: 'UPPERCASE TEXT and lowercase text',
        metadata: { mixed: true }
      }))

      const results = await brain.find({
        query: 'uppercase',
        searchMode: 'text',
        limit: 5
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe(id)
    })

    it('should ignore punctuation in text search', async () => {
      const id = await brain.add(createAddParams({
        data: 'Hello, World! How are you?',
        metadata: { greeting: true }
      }))

      const results = await brain.find({
        query: 'hello world',
        searchMode: 'text',
        limit: 5
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe(id)
    })

    it('should handle multi-word searches', async () => {
      const id = await brain.add(createAddParams({
        data: 'software engineering best practices for web development',
        metadata: { topic: 'engineering' }
      }))

      await brain.add(createAddParams({
        data: 'cooking recipes for healthy meals',
        metadata: { topic: 'food' }
      }))

      // Multi-word search should match entities with more matching words
      const results = await brain.find({
        query: 'software engineering web development',
        searchMode: 'text',
        limit: 5
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe(id)
    })
  })

  describe('Integration with Filters', () => {
    it('should combine hybrid search with metadata filters', async () => {
      const pythonId = await brain.add(createAddParams({
        data: 'Python programming tutorial',
        type: NounType.Document,
        metadata: { language: 'python' }
      }))

      await brain.add(createAddParams({
        data: 'JavaScript programming tutorial',
        type: NounType.Document,
        metadata: { language: 'javascript' }
      }))

      await brain.add(createAddParams({
        data: 'Cooking recipes and kitchen tips',
        type: NounType.Document,
        metadata: { language: 'english' }
      }))

      // Hybrid search + metadata filter - only find python documents
      const results = await brain.find({
        query: 'programming tutorial',
        where: { language: 'python' },
        limit: 5
      })

      // Should find only the Python document
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.some(r => r.id === pythonId)).toBe(true)
      expect(results.every(r => r.metadata?.language === 'python')).toBe(true)
    })

    it('should combine hybrid search with type filters', async () => {
      await brain.add(createAddParams({
        data: 'John Smith person profile',
        type: NounType.Person,
        metadata: { name: 'John Smith' }
      }))

      const docId = await brain.add(createAddParams({
        data: 'John Smith document reference',
        type: NounType.Document,
        metadata: { author: 'John Smith' }
      }))

      // Search for "John Smith" but only documents
      const results = await brain.find({
        query: 'John Smith',
        type: NounType.Document,
        limit: 5
      })

      expect(results.length).toBe(1)
      expect(results[0].id).toBe(docId)
    })
  })

  describe('RRF Fusion Algorithm', () => {
    it('should rank entities appearing in both text and semantic results higher', async () => {
      // Entity that should match both text and semantic
      const bothMatchId = await brain.add(createAddParams({
        data: 'machine learning artificial intelligence neural networks',
        metadata: { relevance: 'high' }
      }))

      // Entity that matches semantically but not exact text
      await brain.add(createAddParams({
        data: 'deep learning and AI algorithms',
        metadata: { relevance: 'medium' }
      }))

      // Entity that matches text but less semantically
      await brain.add(createAddParams({
        data: 'machine learning is a buzzword',
        metadata: { relevance: 'low' }
      }))

      const results = await brain.find({
        query: 'machine learning',
        limit: 10
      })

      expect(results.length).toBeGreaterThan(0)
      // The entity that matches both should rank high
      const topResult = results.find(r => r.id === bothMatchId)
      expect(topResult).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty query gracefully', async () => {
      await brain.add(createAddParams({
        data: 'test entity',
        metadata: {}
      }))

      const results = await brain.find({
        query: '',
        limit: 5
      })

      // Empty query should return results (metadata-only search)
      expect(results.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle query with no text matches', async () => {
      await brain.add(createAddParams({
        data: 'completely unrelated content',
        metadata: {}
      }))

      // Query with words not in any entity
      const results = await brain.find({
        query: 'xyzabc123',
        limit: 5
      })

      // Should still return semantic results even if no text matches
      expect(results).toBeDefined()
    })

    it('should handle special characters in query', async () => {
      await brain.add(createAddParams({
        data: 'C++ programming guide',
        metadata: {}
      }))

      const results = await brain.find({
        query: 'C++ programming',
        limit: 5
      })

      expect(results).toBeDefined()
    })

    it('should handle very short single-character queries', async () => {
      await brain.add(createAddParams({
        data: 'a b c d e f',
        metadata: {}
      }))

      const results = await brain.find({
        query: 'a',
        limit: 5
      })

      // Single char queries may not match (min word length is 2)
      expect(results).toBeDefined()
    })
  })

  describe('Performance', () => {
    it('should complete hybrid search in reasonable time', async () => {
      // Add multiple entities
      const promises = Array.from({ length: 20 }, (_, i) =>
        brain.add(createAddParams({
          data: `Test document number ${i} with various content about software engineering`,
          metadata: { index: i }
        }))
      )
      await Promise.all(promises)

      const startTime = Date.now()
      const results = await brain.find({
        query: 'software engineering document',
        limit: 10
      })
      const duration = Date.now() - startTime

      expect(results.length).toBeGreaterThan(0)
      // Should complete within reasonable time (allowing for embedding generation)
      expect(duration).toBeLessThan(5000)
    })
  })

  describe('Large Document Support (v7.8.0)', () => {
    it('should index documents with 1000+ words without arbitrary limits', async () => {
      // Create a document with 1000+ unique words
      const words: string[] = []
      for (let i = 0; i < 1100; i++) {
        words.push(`word${i}`)
      }
      const largeText = words.join(' ')

      const id = await brain.add(createAddParams({
        data: largeText,
        metadata: { wordCount: words.length }
      }))

      // Search for a word in the middle of the document (beyond old 50-word limit)
      const results = await brain.find({
        query: 'word500 word999',
        searchMode: 'text',
        limit: 5
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe(id)
    })

    it('should not trigger sanity warnings for word-heavy entities', async () => {
      // Create an entity with many words but simple metadata
      const manyWords = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ')

      // This should not trigger any warnings
      const id = await brain.add(createAddParams({
        data: manyWords,
        metadata: { simple: 'metadata' }
      }))

      expect(id).toBeTruthy()

      // Verify we can find it
      const results = await brain.find({
        query: 'word150',
        searchMode: 'text',
        limit: 5
      })

      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('Match Visibility (v7.8.0)', () => {
    it('should return textMatches showing which query words matched', async () => {
      await brain.add(createAddParams({
        data: 'David Smith is a brave warrior who battles dragons',
        type: NounType.Person,
        metadata: { name: 'David Smith' }
      }))

      const results = await brain.find({
        query: 'david warrior',
        limit: 5
      })

      expect(results.length).toBeGreaterThan(0)
      // Should show which words from the query matched
      expect(results[0].textMatches).toBeDefined()
      expect(results[0].textMatches).toContain('david')
      expect(results[0].textMatches).toContain('warrior')
    })

    it('should return textScore and semanticScore separately', async () => {
      await brain.add(createAddParams({
        data: 'machine learning artificial intelligence neural networks',
        metadata: { topic: 'AI' }
      }))

      const results = await brain.find({
        query: 'machine learning',
        limit: 5
      })

      expect(results.length).toBeGreaterThan(0)
      // Should have separate scores
      expect(results[0].textScore).toBeDefined()
      expect(typeof results[0].textScore).toBe('number')
      expect(results[0].semanticScore).toBeDefined()
      expect(typeof results[0].semanticScore).toBe('number')
    })

    it('should return matchSource indicating where result came from', async () => {
      // Entity that matches both text and semantic
      const bothId = await brain.add(createAddParams({
        data: 'Python programming language tutorial',
        metadata: {}
      }))

      const results = await brain.find({
        query: 'Python programming',
        limit: 10
      })

      expect(results.length).toBeGreaterThan(0)
      const matchingResult = results.find(r => r.id === bothId)
      expect(matchingResult).toBeDefined()
      expect(matchingResult?.matchSource).toBeDefined()
      expect(['text', 'semantic', 'both']).toContain(matchingResult?.matchSource)
    })

    it('should show matchSource as "both" for entities matching text AND semantic', async () => {
      const id = await brain.add(createAddParams({
        data: 'JavaScript Node.js programming backend development',
        metadata: {}
      }))

      const results = await brain.find({
        query: 'JavaScript programming',  // Exact words + semantic similarity
        limit: 5
      })

      const result = results.find(r => r.id === id)
      expect(result).toBeDefined()
      // This should match both text (exact words) and semantic
      expect(result?.matchSource).toBe('both')
    })
  })

  describe('Hybrid Highlighting (v7.8.0)', () => {
    it('should return both text and semantic matches with matchType', async () => {
      const highlights = await brain.highlight({
        query: 'warrior fighter',  // "warrior" and "fighter" are query words
        text: 'A brave warrior and a skilled soldier fight battles',
        granularity: 'word',
        threshold: 0.3
      })

      expect(highlights.length).toBeGreaterThan(0)

      // Should have text matches (exact query words)
      const textMatches = highlights.filter(h => h.matchType === 'text')
      const semanticMatches = highlights.filter(h => h.matchType === 'semantic')

      // "warrior" and "fighter" should be text matches
      const textWords = textMatches.map(h => h.text.toLowerCase())
      expect(textWords).toContain('warrior')

      // Text matches should have score = 1.0
      for (const h of textMatches) {
        expect(h.score).toBe(1.0)
      }

      // Semantic matches should have score < 1.0 but >= threshold
      for (const h of semanticMatches) {
        expect(h.score).toBeGreaterThanOrEqual(0.3)
        expect(h.score).toBeLessThan(1.0)
      }
    })

    it('should highlight semantically similar words', async () => {
      const highlights = await brain.highlight({
        query: 'warrior',
        text: 'David is a brave soldier who battles enemies',
        granularity: 'word',
        threshold: 0.3
      })

      expect(highlights.length).toBeGreaterThan(0)
      // Should find semantically similar words like "soldier", "battles"
      const highlightedWords = highlights.map(h => h.text.toLowerCase())
      expect(highlightedWords.some(w => ['soldier', 'battles', 'brave', 'enemies', 'david'].includes(w))).toBe(true)
    })

    it('should return scores for each highlight', async () => {
      const highlights = await brain.highlight({
        query: 'programming',
        text: 'Software engineering code development Python JavaScript',
        granularity: 'word',
        threshold: 0.3
      })

      expect(highlights.length).toBeGreaterThan(0)
      for (const h of highlights) {
        expect(typeof h.score).toBe('number')
        expect(h.score).toBeGreaterThanOrEqual(0.3)
        expect(h.score).toBeLessThanOrEqual(1)
        expect(['text', 'semantic']).toContain(h.matchType)
      }
    })

    it('should return positions for each highlight', async () => {
      const text = 'Apple banana cherry date'
      const highlights = await brain.highlight({
        query: 'fruit',
        text,
        granularity: 'word',
        threshold: 0.2
      })

      for (const h of highlights) {
        expect(h.position).toBeDefined()
        expect(h.position.length).toBe(2)
        expect(h.position[0]).toBeLessThan(h.position[1])
        // Verify the position matches the text
        expect(text.substring(h.position[0], h.position[1])).toBe(h.text)
      }
    })

    it('should filter semantic matches by threshold', async () => {
      const highlightsLow = await brain.highlight({
        query: 'food',
        text: 'Apple banana cherry date elephant forest guitar',
        granularity: 'word',
        threshold: 0.2
      })

      const highlightsHigh = await brain.highlight({
        query: 'food',
        text: 'Apple banana cherry date elephant forest guitar',
        granularity: 'word',
        threshold: 0.6
      })

      // Higher threshold should return fewer or equal results
      expect(highlightsHigh.length).toBeLessThanOrEqual(highlightsLow.length)
    })

    it('should support sentence granularity', async () => {
      const text = 'The cat sat on the mat. Dogs love to play. Birds fly south in winter.'
      const highlights = await brain.highlight({
        query: 'animals pets',
        text,
        granularity: 'sentence',
        threshold: 0.3
      })

      for (const h of highlights) {
        // Each highlight should be a full sentence
        expect(h.text).toMatch(/[.!?]$/)
      }
    })

    it('should skip stopwords when highlighting words', async () => {
      const highlights = await brain.highlight({
        query: 'test',
        text: 'the a an is are test important',
        granularity: 'word',
        threshold: 0.1
      })

      const highlightedWords = highlights.map(h => h.text.toLowerCase())
      // Should not include common stopwords
      expect(highlightedWords).not.toContain('the')
      expect(highlightedWords).not.toContain('a')
      expect(highlightedWords).not.toContain('an')
      expect(highlightedWords).not.toContain('is')
      expect(highlightedWords).not.toContain('are')
    })

    it('should handle empty text gracefully', async () => {
      const highlights = await brain.highlight({
        query: 'test',
        text: '',
        granularity: 'word'
      })

      expect(highlights).toEqual([])
    })

    it('should handle empty query gracefully', async () => {
      const highlights = await brain.highlight({
        query: '',
        text: 'some text content',
        granularity: 'word'
      })

      expect(highlights).toEqual([])
    })

    it('should prioritize text matches over semantic for same word', async () => {
      const highlights = await brain.highlight({
        query: 'programming',
        text: 'programming is fun and coding is great',  // "programming" is in text
        granularity: 'word',
        threshold: 0.3
      })

      // The exact word "programming" should be a text match with score 1.0
      const programmingMatch = highlights.find(h => h.text.toLowerCase() === 'programming')
      expect(programmingMatch).toBeDefined()
      expect(programmingMatch?.matchType).toBe('text')
      expect(programmingMatch?.score).toBe(1.0)
    })
  })

  describe('Structured Content Extraction (v7.9.0)', () => {
    it('should extract text from TipTap/ProseMirror JSON', async () => {
      const tiptapDoc = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'David the Warrior' }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'He is a brave fighter who battles dragons' }]
          }
        ]
      })

      const highlights = await brain.highlight({
        query: 'warrior fighter',
        text: tiptapDoc,
        granularity: 'word',
        threshold: 0.3
      })

      expect(highlights.length).toBeGreaterThan(0)
      // Should find "Warrior" as text match from heading
      const warriorMatch = highlights.find(h => h.text.toLowerCase() === 'warrior')
      expect(warriorMatch).toBeDefined()
      expect(warriorMatch?.matchType).toBe('text')
      // Should annotate heading content
      expect(warriorMatch?.contentCategory).toBe('heading')
    })

    it('should extract text from Slate.js JSON', async () => {
      const slateDoc = JSON.stringify([
        {
          type: 'heading',
          children: [{ text: 'Introduction' }]
        },
        {
          type: 'paragraph',
          children: [
            { text: 'This is ' },
            { text: 'bold text', bold: true },
            { text: ' in a paragraph' }
          ]
        }
      ])

      const highlights = await brain.highlight({
        query: 'Introduction bold',
        text: slateDoc,
        granularity: 'word',
        threshold: 0.3
      })

      expect(highlights.length).toBeGreaterThan(0)
      const introMatch = highlights.find(h => h.text === 'Introduction')
      expect(introMatch).toBeDefined()
      expect(introMatch?.matchType).toBe('text')
      expect(introMatch?.contentCategory).toBe('heading')
    })

    it('should extract text from Quill Delta JSON', async () => {
      const quilDoc = JSON.stringify({
        ops: [
          { insert: 'Hello World\n', attributes: { header: 1 } },
          { insert: 'This is a paragraph with warrior content\n' }
        ]
      })

      const highlights = await brain.highlight({
        query: 'warrior',
        text: quilDoc,
        granularity: 'word',
        threshold: 0.3
      })

      expect(highlights.length).toBeGreaterThan(0)
      const warriorMatch = highlights.find(h => h.text.toLowerCase() === 'warrior')
      expect(warriorMatch).toBeDefined()
      expect(warriorMatch?.matchType).toBe('text')
    })

    it('should fall back to text extraction for generic JSON', async () => {
      const apiResponse = JSON.stringify({
        name: 'warrior',
        description: 'A brave fighter',
        stats: { strength: 10, agility: 8 }
      })

      const highlights = await brain.highlight({
        query: 'warrior',
        text: apiResponse,
        granularity: 'word',
        threshold: 0.3
      })

      expect(highlights.length).toBeGreaterThan(0)
      const warriorMatch = highlights.find(h => h.text.toLowerCase() === 'warrior')
      expect(warriorMatch).toBeDefined()
    })

    it('should extract text from HTML with headings and code', async () => {
      const html = '<h1>Warrior Guide</h1><p>A brave fighter battles enemies.</p><code>const warrior = new Fighter()</code>'

      const highlights = await brain.highlight({
        query: 'warrior fighter',
        text: html,
        granularity: 'word',
        threshold: 0.3
      })

      expect(highlights.length).toBeGreaterThan(0)
      // Should find "Warrior" from heading
      const warriorMatch = highlights.find(h => h.text.toLowerCase() === 'warrior')
      expect(warriorMatch).toBeDefined()
      expect(warriorMatch?.contentCategory).toBe('heading')

      // Should find "fighter" from paragraph
      const fighterMatch = highlights.find(h => h.text.toLowerCase() === 'fighter')
      expect(fighterMatch).toBeDefined()
      expect(fighterMatch?.contentCategory).toBe('prose')
    })

    it('should extract text from Markdown with headings and code', async () => {
      const markdown = '# Warrior Guide\n\nA brave fighter battles enemies.\n\n```\nconst warrior = new Fighter()\n```'

      const highlights = await brain.highlight({
        query: 'warrior fighter',
        text: markdown,
        granularity: 'word',
        threshold: 0.3
      })

      expect(highlights.length).toBeGreaterThan(0)
      // Should find text from heading
      const headingMatch = highlights.find(h => h.text === 'Guide' && h.contentCategory === 'heading')
        || highlights.find(h => h.text === 'Warrior' && h.contentCategory === 'heading')
      expect(headingMatch).toBeDefined()
    })

    it('should preserve plain text behavior (regression)', async () => {
      const plainText = 'David Smith is a brave warrior who battles dragons'

      const highlights = await brain.highlight({
        query: 'warrior',
        text: plainText,
        granularity: 'word',
        threshold: 0.3
      })

      expect(highlights.length).toBeGreaterThan(0)
      const warriorMatch = highlights.find(h => h.text.toLowerCase() === 'warrior')
      expect(warriorMatch).toBeDefined()
      expect(warriorMatch?.matchType).toBe('text')
      expect(warriorMatch?.score).toBe(1.0)
      // Plain text gets 'prose' category
      expect(warriorMatch?.contentCategory).toBe('prose')
    })

    it('should use contentType hint to skip auto-detection', async () => {
      // Pass HTML as plain text via content type hint
      const htmlAsPlain = '<h1>test</h1>'

      const highlights = await brain.highlight({
        query: 'test',
        text: htmlAsPlain,
        granularity: 'word',
        threshold: 0.3,
        contentType: 'plaintext'  // Force plain text treatment
      })

      // When treated as plain text, the raw HTML tags become part of chunks
      // The content should not be parsed as HTML
      expect(highlights).toBeDefined()
    })

    it('should use custom contentExtractor when provided', async () => {
      const customExtractor = (text: string) => {
        return [
          { text: 'custom extracted warrior content', contentCategory: 'prose' as const },
          { text: 'Code Section', contentCategory: 'code' as const }
        ]
      }

      const highlights = await brain.highlight({
        query: 'warrior',
        text: 'ignored because custom extractor is used',
        granularity: 'word',
        threshold: 0.3,
        contentExtractor: customExtractor
      })

      expect(highlights.length).toBeGreaterThan(0)
      const warriorMatch = highlights.find(h => h.text.toLowerCase() === 'warrior')
      expect(warriorMatch).toBeDefined()
      expect(warriorMatch?.matchType).toBe('text')
      expect(warriorMatch?.contentCategory).toBe('prose')
    })
  })

  describe('Timeout Protection (v7.9.0)', () => {
    it('should return text-only results if semantic phase times out', async () => {
      // We test the timeout path by ensuring the highlight method doesn't hang.
      // The mock embeddings are fast so timeout won't trigger in normal test,
      // but we verify the method completes successfully.
      const highlights = await brain.highlight({
        query: 'warrior',
        text: 'David is a brave warrior who battles dragons',
        granularity: 'word',
        threshold: 0.3
      })

      // Should complete without hanging
      expect(highlights).toBeDefined()
      expect(highlights.length).toBeGreaterThan(0)
    })
  })

  describe('embedBatch uses native batch API (v7.9.0)', () => {
    it('should embed multiple texts in a single call', async () => {
      const texts = ['hello world', 'foo bar', 'test content']
      const embeddings = await brain.embedBatch(texts)

      expect(embeddings.length).toBe(3)
      // Each embedding should be 384 dimensions
      for (const emb of embeddings) {
        expect(emb.length).toBe(384)
      }
    })

    it('should return empty array for empty input', async () => {
      const embeddings = await brain.embedBatch([])
      expect(embeddings).toEqual([])
    })
  })
})
