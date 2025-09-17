/**
 * Universal File System implementation
 * Framework-friendly: Trusts that frameworks provide fs polyfills
 * Works in all environments: Browser (via framework), Node.js, Serverless
 */

import { isNode } from '../utils/environment.js'

let nodeFs: any = null

// Dynamic import for Node.js fs (only in Node.js environment)
if (isNode()) {
  try {
    // Use node: protocol to prevent bundler polyfilling (requires Node 22+)
    // Import main module and access promises to avoid subpath issues with bundlers
    const fs = await import('node:fs')
    nodeFs = fs.promises
  } catch {
    // Ignore import errors in non-Node environments
  }
}

/**
 * Universal file operations interface
 */
export interface UniversalFS {
  readFile(path: string, encoding?: string): Promise<string>
  writeFile(path: string, data: string, encoding?: string): Promise<void>
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
  exists(path: string): Promise<boolean>
  readdir(path: string): Promise<string[]>
  readdir(path: string, options: { withFileTypes: true }): Promise<{ name: string, isDirectory(): boolean, isFile(): boolean }[]>
  unlink(path: string): Promise<void>
  stat(path: string): Promise<{ isFile(): boolean, isDirectory(): boolean }>
  access(path: string, mode?: number): Promise<void>
}

/**
 * Node.js implementation using fs/promises
 */
class NodeFS implements UniversalFS {
  async readFile(path: string, encoding = 'utf-8'): Promise<string> {
    return await nodeFs.readFile(path, encoding)
  }

  async writeFile(path: string, data: string, encoding = 'utf-8'): Promise<void> {
    await nodeFs.writeFile(path, data, encoding)
  }

  async mkdir(path: string, options = { recursive: true }): Promise<void> {
    await nodeFs.mkdir(path, options)
  }

  async exists(path: string): Promise<boolean> {
    try {
      await nodeFs.access(path)
      return true
    } catch {
      return false
    }
  }

  async readdir(path: string): Promise<string[]>
  async readdir(path: string, options: { withFileTypes: true }): Promise<{ name: string, isDirectory(): boolean, isFile(): boolean }[]>
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | { name: string, isDirectory(): boolean, isFile(): boolean }[]> {
    if (options?.withFileTypes) {
      return await nodeFs.readdir(path, { withFileTypes: true })
    }
    return await nodeFs.readdir(path)
  }

  async unlink(path: string): Promise<void> {
    await nodeFs.unlink(path)
  }

  async stat(path: string): Promise<{ isFile(): boolean, isDirectory(): boolean }> {
    const stats = await nodeFs.stat(path)
    return {
      isFile: () => stats.isFile(),
      isDirectory: () => stats.isDirectory()
    }
  }

  async access(path: string, mode?: number): Promise<void> {
    await nodeFs.access(path, mode)
  }
}

// Create the appropriate filesystem implementation
let fsImpl: UniversalFS

if (isNode() && nodeFs) {
  fsImpl = new NodeFS()
} else {
  throw new Error('File system operations not available. Framework bundlers should provide fs polyfills or use storage adapters like OPFS, Memory, or S3.')
}

// Export the filesystem operations
export const readFile = fsImpl.readFile.bind(fsImpl)
export const writeFile = fsImpl.writeFile.bind(fsImpl)
export const mkdir = fsImpl.mkdir.bind(fsImpl)
export const exists = fsImpl.exists.bind(fsImpl)
export const readdir = fsImpl.readdir.bind(fsImpl)
export const unlink = fsImpl.unlink.bind(fsImpl)
export const stat = fsImpl.stat.bind(fsImpl)
export const access = fsImpl.access.bind(fsImpl)

// Default export with promises namespace compatibility  
export default {
  readFile,
  writeFile,
  mkdir,
  exists,
  readdir,
  unlink,
  stat,
  access
}

// Named export for fs/promises compatibility
export const promises = {
  readFile,
  writeFile,
  mkdir,
  exists,
  readdir,
  unlink,
  stat,
  access
}