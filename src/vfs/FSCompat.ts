/**
 * fs-Compatible Interface for VFS
 *
 * Provides a drop-in replacement for Node's fs module
 * that uses VFS for storage instead of the real filesystem.
 *
 * Usage:
 *   import { FSCompat } from '@soulcraft/brainy/vfs'
 *   const fs = new FSCompat(brain.vfs)
 *
 *   // Now use like Node's fs
 *   await fs.promises.readFile('/path')
 *   fs.createReadStream('/path').pipe(output)
 */

import { VirtualFileSystem } from './VirtualFileSystem.js'
import type {
  ReadOptions,
  WriteOptions,
  MkdirOptions,
  VFSStats,
  VFSDirent
} from './types.js'

export class FSCompat {
  /**
   * Promise-based API (like fs.promises)
   */
  public readonly promises: FSPromises

  constructor(private vfs: VirtualFileSystem) {
    this.promises = new FSPromises(vfs)
  }

  // ============= Callback-style methods (for compatibility) =============

  readFile(path: string, callback: (err: Error | null, data?: Buffer) => void): void
  readFile(path: string, encoding: BufferEncoding, callback: (err: Error | null, data?: string) => void): void
  readFile(path: string, options: any, callback?: any): void {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    this.vfs.readFile(path, options)
      .then(data => {
        if (options?.encoding) {
          callback(null, data.toString(options.encoding))
        } else {
          callback(null, data)
        }
      })
      .catch(err => callback(err))
  }

  writeFile(path: string, data: Buffer | string, callback: (err: Error | null) => void): void
  writeFile(path: string, data: Buffer | string, options: any, callback?: any): void {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, options?.encoding || 'utf8')

    this.vfs.writeFile(path, buffer, options)
      .then(() => callback(null))
      .catch(err => callback(err))
  }

  mkdir(path: string, callback: (err: Error | null) => void): void
  mkdir(path: string, options: any, callback?: any): void {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    this.vfs.mkdir(path, options)
      .then(() => callback(null))
      .catch(err => callback(err))
  }

  rmdir(path: string, callback: (err: Error | null) => void): void
  rmdir(path: string, options: any, callback?: any): void {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    this.vfs.rmdir(path, options)
      .then(() => callback(null))
      .catch(err => callback(err))
  }

  readdir(path: string, callback: (err: Error | null, files?: string[]) => void): void
  readdir(path: string, options: any, callback?: any): void {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    this.vfs.readdir(path, options)
      .then(files => callback(null, files))
      .catch(err => callback(err))
  }

  stat(path: string, callback: (err: Error | null, stats?: VFSStats) => void): void {
    this.vfs.stat(path)
      .then(stats => callback(null, stats))
      .catch(err => callback(err))
  }

  lstat(path: string, callback: (err: Error | null, stats?: VFSStats) => void): void {
    this.vfs.lstat(path)
      .then(stats => callback(null, stats))
      .catch(err => callback(err))
  }

  unlink(path: string, callback: (err: Error | null) => void): void {
    this.vfs.unlink(path)
      .then(() => callback(null))
      .catch(err => callback(err))
  }

  rename(oldPath: string, newPath: string, callback: (err: Error | null) => void): void {
    this.vfs.rename(oldPath, newPath)
      .then(() => callback(null))
      .catch(err => callback(err))
  }

  copyFile(src: string, dest: string, callback: (err: Error | null) => void): void
  copyFile(src: string, dest: string, flags: number, callback: (err: Error | null) => void): void
  copyFile(src: string, dest: string, flagsOrCallback: any, callback?: any): void {
    if (typeof flagsOrCallback === 'function') {
      callback = flagsOrCallback
    } else {
      // flags provided but not used
    }

    this.vfs.copy(src, dest)
      .then(() => callback(null))
      .catch(err => callback(err))
  }

  exists(path: string, callback: (exists: boolean) => void): void {
    this.vfs.exists(path)
      .then(exists => callback(exists))
      .catch(() => callback(false))
  }

  access(path: string, callback: (err: Error | null) => void): void
  access(path: string, mode: number, callback: (err: Error | null) => void): void
  access(path: string, modeOrCallback: any, callback?: any): void {
    if (typeof modeOrCallback === 'function') {
      callback = modeOrCallback
    } else {
      // mode provided but not used
    }

    this.vfs.exists(path)
      .then(exists => {
        if (exists) {
          callback(null)
        } else {
          const err: any = new Error('ENOENT: no such file or directory')
          err.code = 'ENOENT'
          callback(err)
        }
      })
      .catch(err => callback(err))
  }

  appendFile(path: string, data: Buffer | string, callback: (err: Error | null) => void): void
  appendFile(path: string, data: Buffer | string, options: any, callback?: any): void {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, options?.encoding || 'utf8')

    this.vfs.appendFile(path, buffer, options)
      .then(() => callback(null))
      .catch(err => callback(err))
  }

  // ============= Stream methods =============

  createReadStream(path: string, options?: any) {
    return this.vfs.createReadStream(path, options)
  }

  createWriteStream(path: string, options?: any) {
    return this.vfs.createWriteStream(path, options)
  }

  // ============= Watch methods =============

  watch(path: string, listener?: any) {
    return this.vfs.watch(path, listener)
  }

  watchFile(path: string, listener: any) {
    return this.vfs.watchFile(path, listener)
  }

  unwatchFile(path: string) {
    return this.vfs.unwatchFile(path)
  }

  // ============= Additional methods =============

  /**
   * Import a directory from real filesystem (VFS extension)
   */
  async importDirectory(sourcePath: string, options?: any) {
    return this.vfs.importDirectory(sourcePath, options)
  }

  /**
   * Search files semantically (VFS extension)
   */
  async search(query: string, options?: any) {
    return this.vfs.search(query, options)
  }
}

/**
 * Promise-based fs API (like fs.promises)
 */
class FSPromises {
  constructor(private vfs: VirtualFileSystem) {}

  async readFile(path: string, options?: any): Promise<Buffer | string> {
    const buffer = await this.vfs.readFile(path, options)
    if (options?.encoding) {
      return buffer.toString(options.encoding)
    }
    return buffer
  }

  async writeFile(path: string, data: Buffer | string, options?: any): Promise<void> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, options?.encoding || 'utf8')
    return this.vfs.writeFile(path, buffer, options)
  }

  async mkdir(path: string, options?: any): Promise<void> {
    return this.vfs.mkdir(path, options)
  }

  async rmdir(path: string, options?: any): Promise<void> {
    return this.vfs.rmdir(path, options)
  }

  async readdir(path: string, options?: any): Promise<string[] | VFSDirent[]> {
    return this.vfs.readdir(path, options)
  }

  async stat(path: string): Promise<VFSStats> {
    return this.vfs.stat(path)
  }

  async lstat(path: string): Promise<VFSStats> {
    return this.vfs.lstat(path)
  }

  async unlink(path: string): Promise<void> {
    return this.vfs.unlink(path)
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    return this.vfs.rename(oldPath, newPath)
  }

  async copyFile(src: string, dest: string, flags?: number): Promise<void> {
    return this.vfs.copy(src, dest)
  }

  async access(path: string, mode?: number): Promise<void> {
    const exists = await this.vfs.exists(path)
    if (!exists) {
      const err: any = new Error('ENOENT: no such file or directory')
      err.code = 'ENOENT'
      throw err
    }
  }

  async appendFile(path: string, data: Buffer | string, options?: any): Promise<void> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, options?.encoding || 'utf8')
    return this.vfs.appendFile(path, buffer, options)
  }

  async realpath(path: string): Promise<string> {
    return this.vfs.realpath(path)
  }

  async chmod(path: string, mode: number): Promise<void> {
    return this.vfs.chmod(path, mode)
  }

  async chown(path: string, uid: number, gid: number): Promise<void> {
    return this.vfs.chown(path, uid, gid)
  }

  async utimes(path: string, atime: Date, mtime: Date): Promise<void> {
    return this.vfs.utimes(path, atime, mtime)
  }

  async symlink(target: string, path: string): Promise<void> {
    return this.vfs.symlink(target, path)
  }

  async readlink(path: string): Promise<string> {
    return this.vfs.readlink(path)
  }

  // VFS Extensions
  async search(query: string, options?: any) {
    return this.vfs.search(query, options)
  }

  async findSimilar(path: string, options?: any) {
    return this.vfs.findSimilar(path, options)
  }

  async importDirectory(sourcePath: string, options?: any) {
    return this.vfs.importDirectory(sourcePath, options)
  }
}

// Export a convenience function to create fs replacement
export function createFS(vfs: VirtualFileSystem): FSCompat {
  return new FSCompat(vfs)
}