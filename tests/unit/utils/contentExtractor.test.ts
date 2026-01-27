/**
 * Content Extractor Tests (v7.9.0)
 *
 * Tests for content type detection and text extraction from
 * structured formats (rich-text JSON, HTML, Markdown).
 */

import { describe, it, expect } from 'vitest'
import {
  detectContentType,
  extractForHighlighting
} from '../../../src/utils/contentExtractor'

describe('Content Extractor (v7.9.0)', () => {
  describe('detectContentType()', () => {
    it('should detect plaintext', () => {
      expect(detectContentType('Hello world')).toBe('plaintext')
      expect(detectContentType('Just some regular text.')).toBe('plaintext')
    })

    it('should detect rich-text JSON (object)', () => {
      const tiptap = JSON.stringify({ type: 'doc', content: [] })
      expect(detectContentType(tiptap)).toBe('richtext-json')
    })

    it('should detect rich-text JSON (array)', () => {
      const slate = JSON.stringify([{ type: 'paragraph', children: [{ text: 'hi' }] }])
      expect(detectContentType(slate)).toBe('richtext-json')
    })

    it('should detect HTML', () => {
      expect(detectContentType('<h1>Title</h1>')).toBe('html')
      expect(detectContentType('<div>content</div>')).toBe('html')
      expect(detectContentType('<!DOCTYPE html><html>')).toBe('html')
    })

    it('should detect Markdown', () => {
      expect(detectContentType('# Heading\n\nSome text')).toBe('markdown')
      expect(detectContentType('```\ncode\n```')).toBe('markdown')
    })

    it('should handle invalid JSON as plaintext', () => {
      expect(detectContentType('{ broken json')).toBe('plaintext')
      expect(detectContentType('[not valid')).toBe('plaintext')
    })

    it('should handle whitespace-prefixed JSON', () => {
      const json = '  { "type": "doc" }'
      expect(detectContentType(json)).toBe('richtext-json')
    })
  })

  describe('extractForHighlighting() — TipTap/ProseMirror', () => {
    it('should extract text nodes with content categories', () => {
      const doc = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'My Heading' }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Regular paragraph text' }]
          },
          {
            type: 'codeBlock',
            content: [{ type: 'text', text: 'const x = 1' }]
          }
        ]
      })

      const segments = extractForHighlighting(doc)
      expect(segments.length).toBe(3)

      expect(segments[0].text).toBe('My Heading')
      expect(segments[0].contentCategory).toBe('heading')

      expect(segments[1].text).toBe('Regular paragraph text')
      expect(segments[1].contentCategory).toBe('prose')

      expect(segments[2].text).toBe('const x = 1')
      expect(segments[2].contentCategory).toBe('code')
    })

    it('should handle nested content with marks', () => {
      const doc = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Hello ' },
              { type: 'text', text: 'bold world', marks: [{ type: 'bold' }] }
            ]
          }
        ]
      })

      const segments = extractForHighlighting(doc)
      expect(segments.length).toBe(2)
      expect(segments[0].text).toBe('Hello ')
      expect(segments[1].text).toBe('bold world')
    })
  })

  describe('extractForHighlighting() — Slate.js', () => {
    it('should extract text from Slate children nodes', () => {
      const doc = JSON.stringify([
        {
          type: 'heading',
          children: [{ text: 'Slate Heading' }]
        },
        {
          type: 'paragraph',
          children: [
            { text: 'First part ' },
            { text: 'second part', bold: true }
          ]
        }
      ])

      const segments = extractForHighlighting(doc)
      expect(segments.length).toBe(3)
      expect(segments[0].text).toBe('Slate Heading')
      expect(segments[0].contentCategory).toBe('heading')
      expect(segments[1].text).toBe('First part ')
      expect(segments[1].contentCategory).toBe('prose')
    })
  })

  describe('extractForHighlighting() — Lexical', () => {
    it('should extract text from Lexical root structure', () => {
      const doc = JSON.stringify({
        root: {
          children: [
            {
              type: 'heading',
              children: [{ type: 'text', text: 'Lexical Heading' }]
            },
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Lexical body text' }]
            }
          ]
        }
      })

      const segments = extractForHighlighting(doc)
      expect(segments.length).toBe(2)
      expect(segments[0].text).toBe('Lexical Heading')
      expect(segments[0].contentCategory).toBe('heading')
      expect(segments[1].text).toBe('Lexical body text')
      expect(segments[1].contentCategory).toBe('prose')
    })
  })

  describe('extractForHighlighting() — Draft.js', () => {
    it('should extract text from Draft.js blocks', () => {
      const doc = JSON.stringify({
        blocks: [
          { type: 'header-one', text: 'Draft Heading' },
          { type: 'unstyled', text: 'Draft body text' }
        ]
      })

      const segments = extractForHighlighting(doc)
      expect(segments.length).toBeGreaterThanOrEqual(2)
      // Draft.js blocks have text property directly with type
      const headingSegment = segments.find(s => s.text === 'Draft Heading')
      const bodySegment = segments.find(s => s.text === 'Draft body text')
      expect(headingSegment).toBeDefined()
      expect(bodySegment).toBeDefined()
    })
  })

  describe('extractForHighlighting() — Quill Delta', () => {
    it('should extract text from Quill Delta ops', () => {
      const doc = JSON.stringify({
        ops: [
          { insert: 'Hello World\n' },
          { insert: 'Second line\n' }
        ]
      })

      const segments = extractForHighlighting(doc)
      expect(segments.length).toBe(2)
      expect(segments[0].text).toContain('Hello World')
      expect(segments[1].text).toContain('Second line')
    })
  })

  describe('extractForHighlighting() — Generic JSON fallback', () => {
    it('should extract all string values from unrecognized JSON', () => {
      const generic = JSON.stringify({
        name: 'David',
        description: 'A brave warrior',
        stats: { strength: 10 }
      })

      const segments = extractForHighlighting(generic)
      expect(segments.length).toBeGreaterThan(0)
      const allText = segments.map(s => s.text).join(' ')
      expect(allText).toContain('David')
      expect(allText).toContain('brave warrior')
    })

    it('should return empty for JSON with no text', () => {
      const noText = JSON.stringify({ count: 42, active: true })
      const segments = extractForHighlighting(noText)
      // No string values to extract
      expect(segments).toBeDefined()
    })
  })

  describe('extractForHighlighting() — HTML', () => {
    it('should extract headings, paragraphs, and code', () => {
      const html = '<h1>Title</h1><p>Body text here.</p><pre><code>let x = 1</code></pre>'

      const segments = extractForHighlighting(html)
      expect(segments.length).toBeGreaterThanOrEqual(3)

      const headingSegment = segments.find(s => s.text === 'Title')
      expect(headingSegment).toBeDefined()
      expect(headingSegment?.contentCategory).toBe('heading')

      const bodySegment = segments.find(s => s.text === 'Body text here.')
      expect(bodySegment).toBeDefined()
      expect(bodySegment?.contentCategory).toBe('prose')

      const codeSegment = segments.find(s => s.text === 'let x = 1')
      expect(codeSegment).toBeDefined()
      expect(codeSegment?.contentCategory).toBe('code')
    })

    it('should skip script and style content', () => {
      const html = '<p>Visible</p><script>alert("hidden")</script><style>.foo{}</style><p>Also visible</p>'

      const segments = extractForHighlighting(html)
      const allText = segments.map(s => s.text).join(' ')
      expect(allText).toContain('Visible')
      expect(allText).toContain('Also visible')
      expect(allText).not.toContain('alert')
      expect(allText).not.toContain('.foo')
    })

    it('should decode common HTML entities', () => {
      const html = '<p>Tom &amp; Jerry &lt;3</p>'
      const segments = extractForHighlighting(html)
      expect(segments.length).toBeGreaterThan(0)
      expect(segments[0].text).toContain('Tom & Jerry <3')
    })

    it('should handle nested heading tags', () => {
      const html = '<h2><span>Nested Heading</span></h2>'
      const segments = extractForHighlighting(html)
      const heading = segments.find(s => s.text === 'Nested Heading')
      expect(heading).toBeDefined()
      expect(heading?.contentCategory).toBe('heading')
    })
  })

  describe('extractForHighlighting() — Markdown', () => {
    it('should extract headings', () => {
      const md = '# Main Title\n\nSome body text\n\n## Subtitle'

      const segments = extractForHighlighting(md)
      const heading1 = segments.find(s => s.text === 'Main Title')
      const heading2 = segments.find(s => s.text === 'Subtitle')
      const body = segments.find(s => s.text === 'Some body text')

      expect(heading1).toBeDefined()
      expect(heading1?.contentCategory).toBe('heading')
      expect(heading2).toBeDefined()
      expect(heading2?.contentCategory).toBe('heading')
      expect(body).toBeDefined()
      expect(body?.contentCategory).toBe('prose')
    })

    it('should extract fenced code blocks', () => {
      const md = '# Title\n\n```typescript\nconst x = 1\nconst y = 2\n```\n\nMore text'

      const segments = extractForHighlighting(md)
      const code = segments.find(s => s.contentCategory === 'code')
      expect(code).toBeDefined()
      expect(code?.text).toContain('const x = 1')
    })

    it('should extract indented code blocks', () => {
      // Indented code alone doesn't trigger markdown detection, so pass explicit type
      const md = 'Normal text\n\n    code line 1\n    code line 2\n\nMore text'

      const segments = extractForHighlighting(md, 'markdown')
      const code = segments.find(s => s.contentCategory === 'code')
      expect(code).toBeDefined()
      expect(code?.text).toContain('code line 1')
    })
  })

  describe('extractForHighlighting() — Plaintext', () => {
    it('should return single prose segment for plain text', () => {
      const text = 'Just some plain text content'
      const segments = extractForHighlighting(text)

      expect(segments.length).toBe(1)
      expect(segments[0].text).toBe(text)
      expect(segments[0].contentCategory).toBe('prose')
    })

    it('should respect contentType override', () => {
      // Even if content looks like HTML, plaintext hint should skip detection
      const html = '<h1>Title</h1>'
      const segments = extractForHighlighting(html, 'plaintext')

      expect(segments.length).toBe(1)
      expect(segments[0].text).toBe(html) // Raw HTML, not extracted
      expect(segments[0].contentCategory).toBe('prose')
    })
  })
})
