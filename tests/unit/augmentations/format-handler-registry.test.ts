/**
 * FormatHandlerRegistry Tests (v5.2.0)
 *
 * Tests for MIME-based format handler registration and routing
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { FormatHandlerRegistry } from '../../../src/augmentations/intelligentImport/FormatHandlerRegistry.js'
import type { FormatHandler, ProcessedData } from '../../../src/augmentations/intelligentImport/types.js'

describe('FormatHandlerRegistry (v5.2.0)', () => {
  let registry: FormatHandlerRegistry

  // Mock handlers for testing
  const createMockHandler = (format: string): FormatHandler => ({
    format,
    async process(): Promise<ProcessedData> {
      return {
        format,
        data: [],
        metadata: {
          rowCount: 0,
          fields: [],
          processingTime: 0
        }
      }
    },
    canHandle(): boolean {
      return true
    }
  })

  beforeEach(() => {
    registry = new FormatHandlerRegistry()
  })

  describe('Handler Registration', () => {
    it('should register handler with MIME types and extensions', () => {
      const csvHandler = createMockHandler('csv')

      registry.registerHandler({
        name: 'csv',
        mimeTypes: ['text/csv', 'application/csv'],
        extensions: ['.csv', '.tsv'],
        loader: async () => csvHandler
      })

      expect(registry.hasHandler('csv')).toBe(true)
      expect(registry.getRegisteredHandlers()).toContain('csv')
    })

    it('should register multiple handlers', () => {
      registry.registerHandler({
        name: 'csv',
        mimeTypes: ['text/csv'],
        extensions: ['.csv'],
        loader: async () => createMockHandler('csv')
      })

      registry.registerHandler({
        name: 'excel',
        mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        extensions: ['.xlsx'],
        loader: async () => createMockHandler('excel')
      })

      const handlers = registry.getRegisteredHandlers()
      expect(handlers).toContain('csv')
      expect(handlers).toContain('excel')
      expect(handlers).toHaveLength(2)
    })

    it('should normalize extensions (remove leading dots)', () => {
      registry.registerHandler({
        name: 'test',
        mimeTypes: [],
        extensions: ['.txt', 'md'], // Mixed with/without dots
        loader: async () => createMockHandler('test')
      })

      expect(registry.hasHandler('test')).toBe(true)
    })
  })

  describe('MIME Type Routing', () => {
    beforeEach(() => {
      registry.registerHandler({
        name: 'csv',
        mimeTypes: ['text/csv', 'application/csv'],
        extensions: ['.csv', '.tsv'],
        loader: async () => createMockHandler('csv')
      })

      registry.registerHandler({
        name: 'excel',
        mimeTypes: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel'
        ],
        extensions: ['.xlsx', '.xls'],
        loader: async () => createMockHandler('excel')
      })

      registry.registerHandler({
        name: 'pdf',
        mimeTypes: ['application/pdf'],
        extensions: ['.pdf'],
        loader: async () => createMockHandler('pdf')
      })
    })

    it('should get handler by MIME type', async () => {
      const handler = await registry.getHandlerByMimeType('text/csv')
      expect(handler).toBeDefined()
      expect(handler?.format).toBe('csv')
    })

    it('should get handler by Excel MIME type', async () => {
      const handler = await registry.getHandlerByMimeType(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      expect(handler).toBeDefined()
      expect(handler?.format).toBe('excel')
    })

    it('should get handler by legacy Excel MIME type', async () => {
      const handler = await registry.getHandlerByMimeType('application/vnd.ms-excel')
      expect(handler).toBeDefined()
      expect(handler?.format).toBe('excel')
    })

    it('should return null for unknown MIME type', async () => {
      const handler = await registry.getHandlerByMimeType('application/unknown')
      expect(handler).toBeNull()
    })

    it('should list handlers for a MIME type', () => {
      const handlers = registry.getHandlersForMimeType('text/csv')
      expect(handlers).toContain('csv')
    })
  })

  describe('Extension Routing', () => {
    beforeEach(() => {
      registry.registerHandler({
        name: 'csv',
        mimeTypes: ['text/csv'],
        extensions: ['.csv', '.tsv'],
        loader: async () => createMockHandler('csv')
      })

      registry.registerHandler({
        name: 'excel',
        mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        extensions: ['.xlsx', '.xls'],
        loader: async () => createMockHandler('excel')
      })
    })

    it('should get handler by extension (with dot)', async () => {
      const handler = await registry.getHandlerByExtension('.csv')
      expect(handler).toBeDefined()
      expect(handler?.format).toBe('csv')
    })

    it('should get handler by extension (without dot)', async () => {
      const handler = await registry.getHandlerByExtension('csv')
      expect(handler).toBeDefined()
      expect(handler?.format).toBe('csv')
    })

    it('should handle case-insensitive extensions', async () => {
      const handler = await registry.getHandlerByExtension('.XLSX')
      expect(handler).toBeDefined()
      expect(handler?.format).toBe('excel')
    })

    it('should return null for unknown extension', async () => {
      const handler = await registry.getHandlerByExtension('.xyz')
      expect(handler).toBeNull()
    })
  })

  describe('Filename-Based Handler Selection', () => {
    beforeEach(() => {
      registry.registerHandler({
        name: 'csv',
        mimeTypes: ['text/csv'],
        extensions: ['.csv'],
        loader: async () => createMockHandler('csv')
      })

      registry.registerHandler({
        name: 'excel',
        mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        extensions: ['.xlsx'],
        loader: async () => createMockHandler('excel')
      })
    })

    it('should get handler by filename (MIME detection)', async () => {
      const handler = await registry.getHandler('data.xlsx')
      expect(handler).toBeDefined()
      expect(handler?.format).toBe('excel')
    })

    it('should get handler by filename (extension fallback)', async () => {
      const handler = await registry.getHandler('report.csv')
      expect(handler).toBeDefined()
      expect(handler?.format).toBe('csv')
    })

    it('should handle full paths', async () => {
      const handler = await registry.getHandler('/path/to/file.xlsx')
      expect(handler).toBeDefined()
      expect(handler?.format).toBe('excel')
    })

    it('should return null for unsupported filename', async () => {
      const handler = await registry.getHandler('document.txt')
      expect(handler).toBeNull()
    })
  })

  describe('Lazy Loading', () => {
    it('should lazy-load handlers on first access', async () => {
      let loadCount = 0

      registry.registerHandler({
        name: 'csv',
        mimeTypes: ['text/csv'],
        extensions: ['.csv'],
        loader: async () => {
          loadCount++
          return createMockHandler('csv')
        }
      })

      expect(loadCount).toBe(0)

      const handler1 = await registry.getHandlerByName('csv')
      expect(loadCount).toBe(1)
      expect(handler1?.format).toBe('csv')

      // Second access should use cached instance
      const handler2 = await registry.getHandlerByName('csv')
      expect(loadCount).toBe(1) // Still 1, not 2
      expect(handler2).toBe(handler1) // Same instance
    })

    it('should cache handler instances', async () => {
      registry.registerHandler({
        name: 'csv',
        mimeTypes: ['text/csv'],
        extensions: ['.csv'],
        loader: async () => createMockHandler('csv')
      })

      const handler1 = await registry.getHandlerByExtension('.csv')
      const handler2 = await registry.getHandlerByMimeType('text/csv')

      expect(handler2).toBe(handler1) // Same cached instance
    })

    it('should handle loader errors gracefully', async () => {
      registry.registerHandler({
        name: 'failing',
        mimeTypes: ['application/x-failing'],
        extensions: ['.fail'],
        loader: async () => {
          throw new Error('Handler failed to load')
        }
      })

      const handler = await registry.getHandlerByExtension('.fail')
      expect(handler).toBeNull()
    })
  })

  describe('Interface Compatibility', () => {
    it('should implement HandlerRegistry interface', () => {
      // Check required properties exist
      expect(registry.handlers).toBeDefined()
      expect(registry.loaded).toBeDefined()
      expect(typeof registry.register).toBe('function')
      expect(typeof registry.getHandler).toBe('function')
    })

    it('should support register() method for backward compatibility', async () => {
      const csvHandler = createMockHandler('csv')

      registry.register(['.csv', '.tsv'], async () => csvHandler)

      const handler = await registry.getHandler('.csv')
      expect(handler).toBe(csvHandler)
    })

    it('should populate handlers Map for backward compatibility', () => {
      registry.registerHandler({
        name: 'csv',
        mimeTypes: ['text/csv'],
        extensions: ['.csv'],
        loader: async () => createMockHandler('csv')
      })

      expect(registry.handlers.has('csv')).toBe(true)
      expect(typeof registry.handlers.get('csv')).toBe('function')
    })

    it('should populate loaded Map after loading', async () => {
      registry.registerHandler({
        name: 'csv',
        mimeTypes: ['text/csv'],
        extensions: ['.csv'],
        loader: async () => createMockHandler('csv')
      })

      expect(registry.loaded.has('csv')).toBe(false)

      await registry.getHandlerByName('csv')

      expect(registry.loaded.has('csv')).toBe(true)
    })
  })

  describe('Multiple Handlers Per MIME Type', () => {
    it('should support multiple handlers for same MIME type', () => {
      registry.registerHandler({
        name: 'csv-basic',
        mimeTypes: ['text/csv'],
        extensions: ['.csv'],
        loader: async () => createMockHandler('csv-basic')
      })

      registry.registerHandler({
        name: 'csv-advanced',
        mimeTypes: ['text/csv'],
        extensions: ['.csv'],
        loader: async () => createMockHandler('csv-advanced')
      })

      const handlers = registry.getHandlersForMimeType('text/csv')
      expect(handlers).toHaveLength(2)
      expect(handlers).toContain('csv-basic')
      expect(handlers).toContain('csv-advanced')
    })

    it('should return first matching handler', async () => {
      registry.registerHandler({
        name: 'csv-basic',
        mimeTypes: ['text/csv'],
        extensions: ['.csv'],
        loader: async () => createMockHandler('csv-basic')
      })

      registry.registerHandler({
        name: 'csv-advanced',
        mimeTypes: ['text/csv'],
        extensions: ['.csv'],
        loader: async () => createMockHandler('csv-advanced')
      })

      // Should return first registered handler
      const handler = await registry.getHandlerByMimeType('text/csv')
      expect(handler?.format).toBe('csv-basic')
    })
  })

  describe('Registry Management', () => {
    it('should clear all handlers', () => {
      registry.registerHandler({
        name: 'csv',
        mimeTypes: ['text/csv'],
        extensions: ['.csv'],
        loader: async () => createMockHandler('csv')
      })

      expect(registry.hasHandler('csv')).toBe(true)

      registry.clear()

      expect(registry.hasHandler('csv')).toBe(false)
      expect(registry.getRegisteredHandlers()).toHaveLength(0)
    })

    it('should check if handler is registered', () => {
      expect(registry.hasHandler('csv')).toBe(false)

      registry.registerHandler({
        name: 'csv',
        mimeTypes: ['text/csv'],
        extensions: ['.csv'],
        loader: async () => createMockHandler('csv')
      })

      expect(registry.hasHandler('csv')).toBe(true)
      expect(registry.hasHandler('excel')).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle files without extensions', async () => {
      registry.registerHandler({
        name: 'csv',
        mimeTypes: ['text/csv'],
        extensions: ['.csv'],
        loader: async () => createMockHandler('csv')
      })

      const handler = await registry.getHandler('data')
      expect(handler).toBeNull()
    })

    it('should handle empty extension list', () => {
      registry.registerHandler({
        name: 'special',
        mimeTypes: ['application/x-special'],
        extensions: [],
        loader: async () => createMockHandler('special')
      })

      expect(registry.hasHandler('special')).toBe(true)
    })

    it('should handle empty MIME type list', async () => {
      registry.registerHandler({
        name: 'extension-only',
        mimeTypes: [],
        extensions: ['.xyz'],
        loader: async () => createMockHandler('extension-only')
      })

      const handler = await registry.getHandlerByExtension('.xyz')
      expect(handler?.format).toBe('extension-only')
    })
  })
})
