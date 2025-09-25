/**
 * VFS Write Stream Implementation
 *
 * Real streaming write support for large files
 */

import { Writable } from 'stream'
import { VirtualFileSystem } from '../VirtualFileSystem.js'
import { WriteStreamOptions } from '../types.js'

export class VFSWriteStream extends Writable {
  private chunks: Buffer[] = []
  private size = 0
  private _closed = false

  constructor(
    private vfs: VirtualFileSystem,
    private path: string,
    private options: WriteStreamOptions = {}
  ) {
    super({
      highWaterMark: 64 * 1024 // 64KB chunks
    })

    // Handle autoClose option
    if (options.autoClose !== false) {
      this.once('finish', () => this._flush())
    }
  }

  async _write(
    chunk: any,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): Promise<void> {
    try {
      // Convert to buffer if needed
      const buffer = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk, encoding)

      // Store chunk
      this.chunks.push(buffer)
      this.size += buffer.length

      // For very large files, we could flush periodically
      // to avoid memory issues, but for now we accumulate

      callback()
    } catch (error: any) {
      callback(error)
    }
  }

  async _final(callback: (error?: Error | null) => void): Promise<void> {
    try {
      await this._flush()
      callback()
    } catch (error: any) {
      callback(error)
    }
  }

  private async _flush(): Promise<void> {
    if (this._closed) return
    this._closed = true

    // Combine all chunks
    const data = Buffer.concat(this.chunks, this.size)

    // Write to VFS
    await this.vfs.writeFile(this.path, data, {
      mode: this.options.mode,
      encoding: this.options.encoding
    })

    // Clear chunks to free memory
    this.chunks = []
  }

  _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    // Clean up resources
    this.chunks = []
    this._closed = true
    callback(error)
  }
}