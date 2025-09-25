/**
 * VFS Read Stream Implementation
 *
 * Real streaming support for large files
 */

import { Readable } from 'stream'
import { VirtualFileSystem } from '../VirtualFileSystem.js'
import { ReadStreamOptions } from '../types.js'

export class VFSReadStream extends Readable {
  private position: number
  private entity: any = null
  private data: Buffer | null = null

  constructor(
    private vfs: VirtualFileSystem,
    private path: string,
    private options: ReadStreamOptions = {}
  ) {
    super({
      highWaterMark: options.highWaterMark || 64 * 1024 // 64KB chunks
    })

    this.position = options.start || 0
  }

  async _read(size: number): Promise<void> {
    try {
      // Lazy load entity
      if (!this.entity) {
        this.entity = await this.vfs.getEntity(this.path)
        this.data = this.entity.data as Buffer

        if (!Buffer.isBuffer(this.data)) {
          // Convert string to buffer if needed
          this.data = Buffer.from(this.data)
        }
      }

      // Check if we've reached the end
      const end = this.options.end || this.data!.length
      if (this.position >= end) {
        this.push(null) // Signal EOF
        return
      }

      // Calculate chunk size
      const chunkEnd = Math.min(this.position + size, end)
      const chunk = this.data!.slice(this.position, chunkEnd)

      // Update position and push chunk
      this.position = chunkEnd
      this.push(chunk)

    } catch (error: any) {
      this.destroy(error)
    }
  }

  _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    // Clean up resources
    this.entity = null
    this.data = null
    callback(error)
  }
}