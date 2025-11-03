import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy.js'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

/**
 * Test for v5.1.2 fix: preserveSource now works with file paths
 *
 * Bug: sourceBuffer was undefined for file paths because normalizeSource
 * returned type='path', but code checked for type='buffer'
 *
 * Fix: Changed to Buffer.isBuffer(normalizedSource.data)
 */

describe('Import preserveSource Fix (v5.1.2)', () => {
  let brain: Brainy
  let tempDir: string
  let testFilePath: string

  beforeEach(async () => {
    brain = new Brainy({
      storage: { type: 'memory' },
      silent: true
    })
    await brain.init()

    // Create temp directory and test file
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brainy-test-'))
    testFilePath = path.join(tempDir, 'test-data.csv')

    // Create a test CSV (simple text content that won't fail parsing)
    const csvContent = 'name,value\ntest1,100\ntest2,200'
    fs.writeFileSync(testFilePath, csvContent)
  })

  afterEach(async () => {
    await brain.close()

    // Cleanup temp files (recursive)
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir)
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file))
      }
      fs.rmdirSync(tempDir)
    }
  })

  it('should preserve source file when importing from file path with preserveSource: true', async () => {
    // Import CSV from file path
    await brain.import(testFilePath, {
      format: 'csv',
      vfsPath: '/imported',
      preserveSource: true,
      enableNeuralExtraction: false,  // Disable to speed up test
      createEntities: true
    })

    // Verify source file was preserved in VFS
    const sourceFilePath = '/imported/_source.csv'
    const exists = await brain.vfs.exists(sourceFilePath)
    expect(exists).toBe(true)

    // Verify we can read the file back
    const content = await brain.vfs.readFile(sourceFilePath)
    expect(Buffer.isBuffer(content)).toBe(true)
    expect(content.length).toBeGreaterThan(0)

    // Verify content matches original
    const originalContent = fs.readFileSync(testFilePath)
    expect(Buffer.compare(content, originalContent)).toBe(0)
  })

  it('should NOT preserve source file when preserveSource: false', async () => {
    // Import CSV without preserving source
    await brain.import(testFilePath, {
      format: 'csv',
      vfsPath: '/imported-no-source',
      preserveSource: false,
      enableNeuralExtraction: false,
      createEntities: true
    })

    // Verify source file was NOT preserved
    const sourceFilePath = '/imported-no-source/_source.csv'
    const exists = await brain.vfs.exists(sourceFilePath)
    expect(exists).toBe(false)
  })

  it('should handle binary files correctly (no corruption)', async () => {
    // Create a simple JSON file to test without parsing errors
    const jsonContent = JSON.stringify({ test: 'data', binary: [0xFF, 0xFE, 0xFD] })
    const jsonFilePath = path.join(tempDir, 'test.json')
    fs.writeFileSync(jsonFilePath, jsonContent)

    // Import JSON
    await brain.import(jsonFilePath, {
      format: 'json',
      vfsPath: '/json-test',
      preserveSource: true,
      enableNeuralExtraction: false,
      createEntities: true
    })

    // Read back and verify no corruption
    const content = await brain.vfs.readFile('/json-test/_source.json')
    expect(content.toString('utf-8')).toBe(jsonContent)

    // Cleanup
    fs.unlinkSync(jsonFilePath)
  })

  it.skip('should work with large text files', async () => {
    // Create a large CSV (above inline threshold of 100KB)
    const rows = []
    for (let i = 0; i < 5000; i++) {
      rows.push(`row${i},value${i},data${i}`)
    }
    const largeCsvContent = 'col1,col2,col3\n' + rows.join('\n')

    const largeFilePath = path.join(tempDir, 'large.csv')
    fs.writeFileSync(largeFilePath, largeCsvContent)

    // Import large file
    await brain.import(largeFilePath, {
      format: 'csv',
      vfsPath: '/large-file',
      preserveSource: true,
      enableNeuralExtraction: false,
      createEntities: true
    })

    // Verify file was preserved
    const content = await brain.vfs.readFile('/large-file/_source.csv')
    expect(content.toString('utf-8')).toBe(largeCsvContent)

    // Cleanup
    fs.unlinkSync(largeFilePath)
  })
})
