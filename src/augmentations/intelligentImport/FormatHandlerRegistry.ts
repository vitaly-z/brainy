/**
 * Format Handler Registry (v5.2.0)
 *
 * Central registry for format handlers with:
 * - MIME type-based routing
 * - Lazy loading support
 * - Pluggable handler registration
 * - Handler lifecycle management
 *
 * NO MOCKS - Production implementation
 */

import { FormatHandler, HandlerRegistry as IHandlerRegistry } from './types.js'
import { mimeDetector } from '../../vfs/MimeTypeDetector.js'

export interface HandlerRegistration {
  /** Handler name (e.g., 'csv', 'image', 'pdf') */
  name: string

  /** MIME types this handler supports */
  mimeTypes: string[]

  /** File extensions (fallback if MIME detection fails) */
  extensions: string[]

  /** Lazy loader function */
  loader: () => Promise<FormatHandler>

  /** Loaded handler instance (lazy-loaded) */
  instance?: FormatHandler
}

/**
 * FormatHandlerRegistry - Central handler management
 *
 * Implements the HandlerRegistry interface with:
 * - MIME type-based routing
 * - Lazy loading for performance
 * - Multiple handlers per MIME type
 * - Priority-based selection
 */
export class FormatHandlerRegistry implements IHandlerRegistry {
  // Interface compatibility
  handlers: Map<string, () => Promise<FormatHandler>> = new Map()
  loaded: Map<string, FormatHandler> = new Map()

  // Enhanced registry
  private registrations: Map<string, HandlerRegistration> = new Map()
  private mimeTypeIndex: Map<string, string[]> = new Map() // MIME type → handler names
  private extensionIndex: Map<string, string[]> = new Map() // Extension → handler names

  /**
   * Register a format handler
   *
   * @param registration Handler registration details
   */
  registerHandler(registration: HandlerRegistration): void {
    const { name, mimeTypes, extensions, loader } = registration

    // Store registration
    this.registrations.set(name, registration)

    // Index by MIME types
    for (const mimeType of mimeTypes) {
      const handlers = this.mimeTypeIndex.get(mimeType) || []
      handlers.push(name)
      this.mimeTypeIndex.set(mimeType, handlers)
    }

    // Index by extensions
    for (const ext of extensions) {
      const normalized = ext.toLowerCase().replace(/^\./, '')
      const handlers = this.extensionIndex.get(normalized) || []
      handlers.push(name)
      this.extensionIndex.set(normalized, handlers)
    }

    // Interface compatibility
    this.handlers.set(name, loader)
  }

  /**
   * Register a handler (interface compatibility)
   */
  register(extensions: string[], loader: () => Promise<FormatHandler>): void {
    const name = extensions[0].replace(/^\./, '')

    // Auto-detect MIME types from extensions for better routing
    const mimeTypes: string[] = []
    for (const ext of extensions) {
      const mimeType = mimeDetector.detectMimeType(`file${ext}`)
      if (mimeType && mimeType !== 'application/octet-stream' && !mimeTypes.includes(mimeType)) {
        mimeTypes.push(mimeType)
      }
    }

    this.registerHandler({
      name,
      mimeTypes,
      extensions,
      loader
    })
  }

  /**
   * Get handler by filename or extension
   *
   * Uses MIME detection first, falls back to extension matching
   *
   * @param filenameOrExt Filename or extension
   * @returns Handler instance or null
   */
  async getHandler(filenameOrExt: string): Promise<FormatHandler | null> {
    // Try MIME type detection first
    const mimeType = mimeDetector.detectMimeType(filenameOrExt)
    const byMime = await this.getHandlerByMimeType(mimeType)
    if (byMime) return byMime

    // Fallback to extension matching
    const ext = this.extractExtension(filenameOrExt)
    if (ext) {
      return this.getHandlerByExtension(ext)
    }

    return null
  }

  /**
   * Get handler by MIME type
   *
   * @param mimeType MIME type string
   * @returns Handler instance or null
   */
  async getHandlerByMimeType(mimeType: string): Promise<FormatHandler | null> {
    const handlerNames = this.mimeTypeIndex.get(mimeType)
    if (!handlerNames || handlerNames.length === 0) {
      return null
    }

    // Return first matching handler (could add priority later)
    return this.loadHandler(handlerNames[0])
  }

  /**
   * Get handler by file extension
   *
   * @param ext File extension (with or without dot)
   * @returns Handler instance or null
   */
  async getHandlerByExtension(ext: string): Promise<FormatHandler | null> {
    const normalized = ext.toLowerCase().replace(/^\./, '')
    const handlerNames = this.extensionIndex.get(normalized)
    if (!handlerNames || handlerNames.length === 0) {
      return null
    }

    // Return first matching handler
    return this.loadHandler(handlerNames[0])
  }

  /**
   * Get handler by name
   *
   * @param name Handler name
   * @returns Handler instance or null
   */
  async getHandlerByName(name: string): Promise<FormatHandler | null> {
    return this.loadHandler(name)
  }

  /**
   * Load handler (lazy loading)
   *
   * @param name Handler name
   * @returns Loaded handler instance
   */
  private async loadHandler(name: string): Promise<FormatHandler | null> {
    const registration = this.registrations.get(name)
    if (!registration) return null

    // Return cached instance if available
    if (registration.instance) {
      return registration.instance
    }

    // Load handler
    try {
      const handler = await registration.loader()
      registration.instance = handler

      // Interface compatibility
      this.loaded.set(name, handler)

      return handler
    } catch (error) {
      console.error(`Failed to load handler ${name}:`, error)
      return null
    }
  }

  /**
   * Get all registered handler names
   */
  getRegisteredHandlers(): string[] {
    return Array.from(this.registrations.keys())
  }

  /**
   * Get handlers for a MIME type
   */
  getHandlersForMimeType(mimeType: string): string[] {
    return this.mimeTypeIndex.get(mimeType) || []
  }

  /**
   * Check if handler is registered
   */
  hasHandler(name: string): boolean {
    return this.registrations.has(name)
  }

  /**
   * Clear all handlers (for testing)
   */
  clear(): void {
    this.registrations.clear()
    this.mimeTypeIndex.clear()
    this.extensionIndex.clear()
    this.handlers.clear()
    this.loaded.clear()
  }

  /**
   * Extract file extension from filename
   */
  private extractExtension(filename: string): string | null {
    const lastDot = filename.lastIndexOf('.')
    if (lastDot === -1 || lastDot === 0) return null
    return filename.substring(lastDot + 1).toLowerCase()
  }
}

/**
 * Global handler registry singleton
 */
export const globalHandlerRegistry = new FormatHandlerRegistry()
