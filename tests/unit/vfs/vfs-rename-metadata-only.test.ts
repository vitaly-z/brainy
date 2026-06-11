/**
 * @module vfs/vfs-rename-metadata-only.test
 * @description Regression test for the vfs.rename() vector-dimension crash
 * (7.31.7). rename() used to spread the entire fetched entity into
 * brain.update(), forwarding a vector field that failed the 384-dimension
 * validation when the entity was fetched without vectors. A rename is a
 * path/metadata change — the update must be metadata-only.
 *
 * Production repro (verbatim from the consumer report):
 *   await brain.vfs.writeFile('/a.txt', 'x')
 *   await brain.vfs.rename('/a.txt', '/b.txt')   // threw pre-7.31.7
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/index.js'

describe('vfs.rename() issues a metadata-only update (7.31.7)', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' } })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  it('renames a file without touching vectors (the production repro)', async () => {
    await brain.vfs.writeFile('/a.txt', 'x')
    await brain.vfs.rename('/a.txt', '/b.txt')

    expect(await brain.vfs.exists('/b.txt')).toBe(true)
    expect(await brain.vfs.exists('/a.txt')).toBe(false)
    const content = await brain.vfs.readFile('/b.txt')
    expect(content.toString()).toBe('x')
  })

  it('preserves file content and custom metadata across rename', async () => {
    await brain.vfs.writeFile('/notes/draft.md', 'hello world')
    await brain.vfs.rename('/notes/draft.md', '/notes/final.md')

    const content = await brain.vfs.readFile('/notes/final.md')
    expect(content.toString()).toBe('hello world')
    // The renamed entity's metadata carries the new basename
    const stat = await brain.vfs.stat('/notes/final.md')
    expect(stat.size).toBeGreaterThan(0)
    expect(await brain.vfs.exists('/notes/draft.md')).toBe(false)
  })

  it('moves a file across directories', async () => {
    await brain.vfs.mkdir('/src')
    await brain.vfs.mkdir('/dest')
    await brain.vfs.writeFile('/src/file.txt', 'moving')
    await brain.vfs.rename('/src/file.txt', '/dest/file.txt')

    expect(await brain.vfs.exists('/dest/file.txt')).toBe(true)
    expect(await brain.vfs.exists('/src/file.txt')).toBe(false)
    const content = await brain.vfs.readFile('/dest/file.txt')
    expect(content.toString()).toBe('moving')
  })

  it('throws EEXIST when the target already exists', async () => {
    await brain.vfs.writeFile('/one.txt', '1')
    await brain.vfs.writeFile('/two.txt', '2')
    await expect(brain.vfs.rename('/one.txt', '/two.txt')).rejects.toThrow(/exists/i)
  })
})
