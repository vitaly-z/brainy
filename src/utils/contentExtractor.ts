/**
 * Content Extractor
 *
 * Detects content type (plaintext, rich-text JSON, HTML, Markdown) and extracts
 * text segments with content categories (title, content, code, etc.).
 *
 * Supports common rich-text editor formats:
 * - TipTap / ProseMirror: { type: 'doc', content: [...] }
 * - Slate.js: [{ type, children: [{ text }] }]
 * - Lexical: { root: { children: [...] } }
 * - Draft.js: { blocks: [{ text }] }
 * - Quill Delta: { ops: [{ insert }] }
 *
 * Falls back gracefully: structured text that doesn't match known patterns
 * is extracted as plain content via recursive text collection.
 */

import type { ContentType, ContentCategory, ExtractedSegment } from '../types/brainy.types.js'

/**
 * Detect content type from text content (no filename needed)
 */
export function detectContentType(text: string): ContentType {
  const trimmed = text.trimStart()

  // JSON detection (covers TipTap, Slate, Lexical, Draft.js, Quill, etc.)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed)
      return 'richtext-json'
    } catch {
      // Not valid JSON, fall through
    }
  }

  // HTML detection (tag at start of content)
  if (/<[a-z!][a-z0-9]*[\s>/]/i.test(trimmed.substring(0, 200))) {
    return 'html'
  }

  // Markdown detection (heading or code fence at start)
  if (/^#{1,6}\s/m.test(trimmed.substring(0, 500)) ||
      /^```/m.test(trimmed.substring(0, 500))) {
    return 'markdown'
  }

  return 'plaintext'
}

/**
 * Extract text segments from content, auto-detecting type if not provided
 */
export function extractForHighlighting(
  text: string,
  contentType?: ContentType
): ExtractedSegment[] {
  const type = contentType || detectContentType(text)

  switch (type) {
    case 'richtext-json':
      return extractFromJson(text)
    case 'html':
      return extractFromHtml(text)
    case 'markdown':
      return extractFromMarkdown(text)
    case 'plaintext':
    default:
      return [{ text, contentCategory: 'content' }]
  }
}

// ============= Rich-Text JSON Extraction =============

/**
 * Extract text from any JSON rich-text format.
 * Walks the node tree looking for text leaves across all common editors.
 */
function extractFromJson(text: string): ExtractedSegment[] {
  let parsed: any
  try {
    parsed = JSON.parse(text.trim())
  } catch {
    // Invalid JSON — treat as plain text
    return [{ text, contentCategory: 'content' }]
  }

  const segments = walkRichTextNodes(parsed)

  // If the walker found real text segments, return them
  if (segments.length > 0 && segments.some(s => s.text.trim().length > 0)) {
    return segments.filter(s => s.text.trim().length > 0)
  }

  // Fallback: collect all string values from the JSON
  const fallbackText = extractTextFromJsonValue(parsed)
  if (fallbackText.trim()) {
    return [{ text: fallbackText, contentCategory: 'content' }]
  }

  return []
}

/**
 * Walk rich-text nodes recursively.
 * Handles TipTap/ProseMirror, Slate, Lexical, Draft.js, and Quill Delta.
 */
function walkRichTextNodes(node: any): ExtractedSegment[] {
  if (node === null || node === undefined) return []

  const segments: ExtractedSegment[] = []

  // Handle arrays (Slate root is an array, Draft.js blocks, Quill ops)
  if (Array.isArray(node)) {
    for (const child of node) {
      segments.push(...walkRichTextNodes(child))
    }
    return segments
  }

  if (typeof node !== 'object') return []

  // Leaf: text content (TipTap/ProseMirror/Lexical/Slate)
  if (typeof node.text === 'string' && node.text.length > 0) {
    segments.push({ text: node.text, contentCategory: 'content' })
    return segments
  }

  // Leaf: Quill Delta insert
  if (typeof node.insert === 'string' && node.insert.length > 0) {
    segments.push({ text: node.insert, contentCategory: 'content' })
    return segments
  }

  // Draft.js block with text
  if (typeof node.text === 'string' && node.type !== undefined && node.text.length > 0) {
    const category = categorizeNodeType(node.type)
    segments.push({ text: node.text, contentCategory: category })
    return segments
  }

  // Categorize by node type
  const category = categorizeNodeType(node.type)

  // Walk children arrays: content (TipTap), children (Slate/Lexical), blocks (Draft.js), ops (Quill)
  const children = node.content || node.children || node.blocks || node.ops
  if (Array.isArray(children)) {
    for (const child of children) {
      const childSegments = walkRichTextNodes(child)
      // Apply parent's category if it's more specific than 'content'
      if (category !== 'content') {
        childSegments.forEach(s => { s.contentCategory = category })
      }
      segments.push(...childSegments)
    }
  }

  // Lexical root wrapper
  if (node.root && typeof node.root === 'object') {
    segments.push(...walkRichTextNodes(node.root))
  }

  return segments
}

/**
 * Categorize a node type string into a ContentCategory
 */
function categorizeNodeType(type?: string): ContentCategory {
  if (!type) return 'content'
  const t = type.toLowerCase()
  if (t === 'heading' || /^h[1-6]$/.test(t)) return 'title'
  if (t === 'code' || t === 'codeblock' || t === 'code_block') return 'code'
  return 'content'
}

/**
 * Fallback: recursively extract all string values from JSON
 */
function extractTextFromJsonValue(value: any): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map(extractTextFromJsonValue).filter(Boolean).join(' ')
  }
  if (typeof value === 'object' && value !== null) {
    const texts: string[] = []
    for (const v of Object.values(value)) {
      const text = extractTextFromJsonValue(v)
      if (text) texts.push(text)
    }
    return texts.join(' ')
  }
  return ''
}

// ============= HTML Extraction =============

/**
 * Extract text from HTML using a simple state-machine tag parser.
 * No external dependencies.
 */
function extractFromHtml(html: string): ExtractedSegment[] {
  const segments: ExtractedSegment[] = []
  let current = ''
  let currentCategory: ContentCategory = 'content'
  let i = 0
  let insideTag = false
  let tagName = ''
  let isClosingTag = false
  let skipContent = false

  // Tag stack to track nesting
  const tagStack: string[] = []

  while (i < html.length) {
    if (html[i] === '<') {
      // Flush current text if we have any
      if (current.trim() && !skipContent) {
        segments.push({ text: current.trim(), contentCategory: currentCategory })
      }
      current = ''

      insideTag = true
      tagName = ''
      isClosingTag = false
      i++

      // Check for closing tag
      if (i < html.length && html[i] === '/') {
        isClosingTag = true
        i++
      }

      // Read tag name
      while (i < html.length && html[i] !== '>' && html[i] !== ' ' && html[i] !== '/') {
        tagName += html[i]
        i++
      }

      // Skip to end of tag
      while (i < html.length && html[i] !== '>') {
        i++
      }
      if (i < html.length) i++ // skip '>'

      const tagLower = tagName.toLowerCase()

      if (isClosingTag) {
        // Pop tag stack
        if (tagStack.length > 0 && tagStack[tagStack.length - 1] === tagLower) {
          tagStack.pop()
        }
        if (tagLower === 'script' || tagLower === 'style') {
          skipContent = false
        }
        // Reset category based on remaining stack
        currentCategory = getCategoryFromTagStack(tagStack)
      } else {
        // Opening tag
        if (tagLower === 'script' || tagLower === 'style') {
          skipContent = true
        }

        // Self-closing tags don't affect stack
        const selfClosing = html[i - 2] === '/' ||
          ['br', 'hr', 'img', 'input', 'meta', 'link'].includes(tagLower)

        if (!selfClosing) {
          tagStack.push(tagLower)
          currentCategory = getCategoryFromTagStack(tagStack)
        }
      }

      insideTag = false
      continue
    }

    if (!insideTag) {
      // Decode common HTML entities
      if (html[i] === '&') {
        const entityEnd = html.indexOf(';', i)
        if (entityEnd !== -1 && entityEnd - i < 10) {
          const entity = html.substring(i, entityEnd + 1)
          current += decodeHtmlEntity(entity)
          i = entityEnd + 1
          continue
        }
      }
      current += html[i]
    }
    i++
  }

  // Flush remaining text
  if (current.trim() && !skipContent) {
    segments.push({ text: current.trim(), contentCategory: currentCategory })
  }

  return segments.filter(s => s.text.length > 0)
}

/**
 * Determine content category from the current tag stack
 */
function getCategoryFromTagStack(stack: string[]): ContentCategory {
  for (let i = stack.length - 1; i >= 0; i--) {
    const tag = stack[i]
    if (/^h[1-6]$/.test(tag)) return 'title'
    if (tag === 'code' || tag === 'pre') return 'code'
  }
  return 'content'
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntity(entity: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  }
  return entities[entity] || entity
}

// ============= Markdown Extraction =============

/**
 * Split a prose line into alternating content/code segments based on
 * backtick-delimited inline code spans. Lines without backticks return
 * a single 'content' segment.
 */
function splitInlineCode(line: string): ExtractedSegment[] {
  const segments: ExtractedSegment[] = []
  const pattern = /`([^`]+)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(line)) !== null) {
    // Text before the backtick span
    if (match.index > lastIndex) {
      const before = line.substring(lastIndex, match.index).trim()
      if (before.length > 0) {
        segments.push({ text: before, contentCategory: 'content' })
      }
    }
    // The code span (without backticks)
    segments.push({ text: match[1], contentCategory: 'code' })
    lastIndex = match.index + match[0].length
  }

  // Remaining text after last backtick span (or entire line if no backticks)
  if (lastIndex < line.length) {
    const remaining = line.substring(lastIndex).trim()
    if (remaining.length > 0) {
      segments.push({ text: remaining, contentCategory: 'content' })
    }
  }

  return segments
}

/**
 * Extract text from Markdown with category detection
 */
function extractFromMarkdown(text: string): ExtractedSegment[] {
  const segments: ExtractedSegment[] = []
  const lines = text.split('\n')
  let inCodeBlock = false
  let codeContent = ''
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block toggle
    if (/^```/.test(line.trimStart())) {
      if (inCodeBlock) {
        // End of code block
        if (codeContent.trim()) {
          segments.push({ text: codeContent.trim(), contentCategory: 'code' })
        }
        codeContent = ''
        inCodeBlock = false
      } else {
        // Start of code block
        inCodeBlock = true
      }
      i++
      continue
    }

    if (inCodeBlock) {
      codeContent += (codeContent ? '\n' : '') + line
      i++
      continue
    }

    // Indented code block (4 spaces or 1 tab)
    if (/^(?:    |\t)/.test(line) && line.trim().length > 0) {
      let codeLines = line.replace(/^(?:    |\t)/, '')
      i++
      while (i < lines.length && (/^(?:    |\t)/.test(lines[i]) || lines[i].trim() === '')) {
        codeLines += '\n' + lines[i].replace(/^(?:    |\t)/, '')
        i++
      }
      if (codeLines.trim()) {
        segments.push({ text: codeLines.trim(), contentCategory: 'code' })
      }
      continue
    }

    // Heading (# style)
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch) {
      segments.push({ text: headingMatch[1].trim(), contentCategory: 'title' })
      i++
      continue
    }

    // Regular content line — split out inline code spans
    if (line.trim().length > 0) {
      segments.push(...splitInlineCode(line.trim()))
    }

    i++
  }

  // Flush unclosed code block
  if (inCodeBlock && codeContent.trim()) {
    segments.push({ text: codeContent.trim(), contentCategory: 'code' })
  }

  return segments.filter(s => s.text.length > 0)
}
