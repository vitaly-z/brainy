/**
 * VFS Historical Reads Integration Test (v5.3.7)
 *
 * Tests commitId support for time-travel reads:
 * - readFile(path, { commitId })
 * - readdir(path, { commitId })
 * - stat(path, { commitId })
 * - exists(path, { commitId })
 *
 * This is the CRITICAL test for Workshop's time-travel feature.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import * as fs from 'fs'
import * as path from 'path'

describe('VFS Historical Reads (v5.3.7)', () => {
  const testDir = path.join(process.cwd(), 'test-vfs-historical')
  let brain: Brainy

  beforeAll(async () => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    fs.mkdirSync(testDir, { recursive: true })

    // Initialize Brainy with filesystem storage (required for COW)
    brain = new Brainy({
      storage: {
        adapter: 'filesystem',
        path: testDir
      }
    })
    await brain.init()

    // Initialize VFS
    await brain.vfs.init()
  })

  afterAll(async () => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('should read files from historical commits', async () => {
    console.log('\n📁 Test 1: Historical file reading')

    // Commit 1: Empty workspace
    await brain.commit({
      message: 'Initial empty state',
      author: 'test@example.com'
    })
    const history1 = await brain.getHistory({ limit: 1 })
    const emptyCommitId = history1[0].hash
    console.log(`   Empty commit: ${emptyCommitId.slice(0, 8)}`)

    // Create first file
    await brain.vfs.writeFile('/test.md', 'Version 1')

    // Commit 2: First file added
    await brain.commit({
      message: 'Added test.md',
      author: 'test@example.com'
    })
    const history2 = await brain.getHistory({ limit: 1 })
    const v1CommitId = history2[0].hash
    console.log(`   V1 commit: ${v1CommitId.slice(0, 8)}`)

    // Update file
    await brain.vfs.writeFile('/test.md', 'Version 2')

    // Commit 3: File updated
    await brain.commit({
      message: 'Updated test.md',
      author: 'test@example.com'
    })
    const history3 = await brain.getHistory({ limit: 1 })
    const v2CommitId = history3[0].hash
    console.log(`   V2 commit: ${v2CommitId.slice(0, 8)}`)

    // Test 1a: Read current file (should be V2)
    const currentContent = await brain.vfs.readFile('/test.md')
    expect(currentContent.toString()).toBe('Version 2')
    console.log(`   ✅ Current content: "${currentContent.toString()}"`)

    // Test 1b: Read file at V1 commit (should be V1)
    const v1Content = await brain.vfs.readFile('/test.md', { commitId: v1CommitId })
    expect(v1Content.toString()).toBe('Version 1')
    console.log(`   ✅ V1 content: "${v1Content.toString()}"`)

    // Test 1c: Read file at empty commit (should fail - file didn't exist)
    await expect(
      brain.vfs.readFile('/test.md', { commitId: emptyCommitId })
    ).rejects.toThrow('File not found at commit')
    console.log(`   ✅ Empty commit correctly throws ENOENT`)
  })

  it('should list directory contents from historical commits', async () => {
    console.log('\n📂 Test 2: Historical directory listing')

    // Get current commit (from previous test, has /test.md)
    const history1 = await brain.getHistory({ limit: 1 })
    const beforeProjectCommit = history1[0].hash

    // Create project directory with files
    await brain.vfs.mkdir('/project')
    await brain.vfs.writeFile('/project/app.ts', 'console.log("v1")')
    await brain.vfs.writeFile('/project/utils.ts', 'export const util = 1')

    // Commit: Project created
    await brain.commit({
      message: 'Added project directory',
      author: 'test@example.com'
    })
    const history2 = await brain.getHistory({ limit: 1 })
    const projectCommit = history2[0].hash
    console.log(`   Project commit: ${projectCommit.slice(0, 8)}`)

    // Add more files
    await brain.vfs.writeFile('/project/config.json', '{"version": 1}')

    // Commit: Config added
    await brain.commit({
      message: 'Added config',
      author: 'test@example.com'
    })
    const history3 = await brain.getHistory({ limit: 1 })
    const configCommit = history3[0].hash
    console.log(`   Config commit: ${configCommit.slice(0, 8)}`)

    // Test 2a: Read current directory (should have 3 files)
    const currentEntries = await brain.vfs.readdir('/project')
    expect(currentEntries.length).toBe(3)
    expect(currentEntries).toContain('app.ts')
    expect(currentEntries).toContain('utils.ts')
    expect(currentEntries).toContain('config.json')
    console.log(`   ✅ Current directory: ${currentEntries.length} files`)

    // Test 2b: Read directory at project commit (should have 2 files, no config)
    const projectEntries = await brain.vfs.readdir('/project', { commitId: projectCommit })
    expect(projectEntries.length).toBe(2)
    expect(projectEntries).toContain('app.ts')
    expect(projectEntries).toContain('utils.ts')
    expect(projectEntries).not.toContain('config.json')
    console.log(`   ✅ Project commit directory: ${projectEntries.length} files (no config)`)

    // Test 2c: Read directory at before-project commit (should fail - dir didn't exist)
    await expect(
      brain.vfs.readdir('/project', { commitId: beforeProjectCommit })
    ).rejects.toThrow('Directory not found at commit')
    console.log(`   ✅ Before project commit correctly throws ENOENT`)

    // Test 2d: Read root directory at different commits
    const currentRoot = await brain.vfs.readdir('/')
    const projectRoot = await brain.vfs.readdir('/', { commitId: projectCommit })

    // Current root should have both /test.md and /project
    expect(currentRoot.length).toBeGreaterThanOrEqual(2)

    // Project commit root should also have both
    expect(projectRoot.length).toBeGreaterThanOrEqual(2)

    console.log(`   ✅ Root directory listings work at different commits`)
  })

  it('should stat files from historical commits', async () => {
    console.log('\n📊 Test 3: Historical file stats')

    // Create a file and get its initial stats
    await brain.vfs.writeFile('/stats-test.txt', 'Initial content')

    // Commit: Initial file
    await brain.commit({
      message: 'Added stats-test.txt',
      author: 'test@example.com'
    })
    const history1 = await brain.getHistory({ limit: 1 })
    const initialCommit = history1[0].hash
    console.log(`   Initial commit: ${initialCommit.slice(0, 8)}`)

    // Get initial stats
    const initialStats = await brain.vfs.stat('/stats-test.txt', { commitId: initialCommit })
    expect(initialStats.size).toBe('Initial content'.length)
    expect(initialStats.isFile()).toBe(true)
    console.log(`   ✅ Initial stats: ${initialStats.size} bytes`)

    // Wait a moment to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 100))

    // Update file with different content
    await brain.vfs.writeFile('/stats-test.txt', 'Much longer updated content here')

    // Commit: Updated file
    await brain.commit({
      message: 'Updated stats-test.txt',
      author: 'test@example.com'
    })
    const history2 = await brain.getHistory({ limit: 1 })
    const updatedCommit = history2[0].hash
    console.log(`   Updated commit: ${updatedCommit.slice(0, 8)}`)

    // Test 3a: Current stats (should reflect new size)
    const currentStats = await brain.vfs.stat('/stats-test.txt')
    expect(currentStats.size).toBe('Much longer updated content here'.length)
    console.log(`   ✅ Current stats: ${currentStats.size} bytes`)

    // Test 3b: Historical stats (should reflect old size)
    const historicalStats = await brain.vfs.stat('/stats-test.txt', { commitId: initialCommit })
    expect(historicalStats.size).toBe('Initial content'.length)
    expect(historicalStats.size).not.toBe(currentStats.size)
    console.log(`   ✅ Historical stats: ${historicalStats.size} bytes (different from current)`)

    // Test 3c: Stat directory at historical commit
    const dirStats = await brain.vfs.stat('/', { commitId: initialCommit })
    expect(dirStats.isDirectory()).toBe(true)
    expect(dirStats.isFile()).toBe(false)
    console.log(`   ✅ Directory stats work with commitId`)
  })

  it('should check existence from historical commits', async () => {
    console.log('\n✅ Test 4: Historical existence checks')

    // Get current commit
    const history1 = await brain.getHistory({ limit: 1 })
    const beforeNewFileCommit = history1[0].hash

    // Create a new file
    await brain.vfs.writeFile('/new-file.txt', 'New file content')

    // Commit: New file added
    await brain.commit({
      message: 'Added new-file.txt',
      author: 'test@example.com'
    })
    const history2 = await brain.getHistory({ limit: 1 })
    const afterNewFileCommit = history2[0].hash
    console.log(`   Before new file: ${beforeNewFileCommit.slice(0, 8)}`)
    console.log(`   After new file: ${afterNewFileCommit.slice(0, 8)}`)

    // Test 4a: File exists in current state
    const existsNow = await brain.vfs.exists('/new-file.txt')
    expect(existsNow).toBe(true)
    console.log(`   ✅ File exists in current state`)

    // Test 4b: File exists at after-commit
    const existsAfter = await brain.vfs.exists('/new-file.txt', { commitId: afterNewFileCommit })
    expect(existsAfter).toBe(true)
    console.log(`   ✅ File exists at after-commit`)

    // Test 4c: File does NOT exist at before-commit
    const existsBefore = await brain.vfs.exists('/new-file.txt', { commitId: beforeNewFileCommit })
    expect(existsBefore).toBe(false)
    console.log(`   ✅ File correctly doesn't exist at before-commit`)

    // Test 4d: Non-existent file returns false at any commit
    const neverExists = await brain.vfs.exists('/never-created.txt', { commitId: afterNewFileCommit })
    expect(neverExists).toBe(false)
    console.log(`   ✅ Non-existent file returns false at any commit`)

    // Test 4e: Directory existence checks
    const rootExists = await brain.vfs.exists('/', { commitId: beforeNewFileCommit })
    expect(rootExists).toBe(true)
    console.log(`   ✅ Root directory exists at all commits`)
  })

  it('should handle readdir with withFileTypes at historical commits', async () => {
    console.log('\n📋 Test 5: Historical readdir with withFileTypes')

    // Create mixed content
    await brain.vfs.mkdir('/mixed')
    await brain.vfs.writeFile('/mixed/file1.txt', 'File 1')
    await brain.vfs.mkdir('/mixed/subdir')
    await brain.vfs.writeFile('/mixed/file2.txt', 'File 2')

    // Commit: Mixed content
    await brain.commit({
      message: 'Added mixed directory',
      author: 'test@example.com'
    })
    const history = await brain.getHistory({ limit: 1 })
    const mixedCommit = history[0].hash
    console.log(`   Mixed commit: ${mixedCommit.slice(0, 8)}`)

    // Test 5a: readdir with withFileTypes at historical commit
    const entries = await brain.vfs.readdir('/mixed', {
      withFileTypes: true,
      commitId: mixedCommit
    })

    expect(entries.length).toBe(3)

    // Check that we got VFSDirent objects
    const fileEntries = entries.filter((e: any) => e.type === 'file')
    const dirEntries = entries.filter((e: any) => e.type === 'directory')

    expect(fileEntries.length).toBe(2)
    expect(dirEntries.length).toBe(1)

    console.log(`   ✅ withFileTypes: ${fileEntries.length} files, ${dirEntries.length} dirs`)

    // Verify entries have correct properties
    const firstEntry = entries[0] as any
    expect(firstEntry).toHaveProperty('name')
    expect(firstEntry).toHaveProperty('path')
    expect(firstEntry).toHaveProperty('type')
    expect(firstEntry).toHaveProperty('entityId')
    console.log(`   ✅ VFSDirent objects have all required properties`)
  })

  it('should handle errors gracefully for invalid commits', async () => {
    console.log('\n⚠️  Test 6: Error handling for invalid commits')

    const fakeCommitId = 'f'.repeat(64)  // Invalid commit hash

    // Test 6a: readFile with invalid commit
    await expect(
      brain.vfs.readFile('/test.md', { commitId: fakeCommitId })
    ).rejects.toThrow('Invalid commit ID')
    console.log(`   ✅ readFile throws on invalid commit`)

    // Test 6b: readdir with invalid commit
    await expect(
      brain.vfs.readdir('/', { commitId: fakeCommitId })
    ).rejects.toThrow('Invalid commit ID')
    console.log(`   ✅ readdir throws on invalid commit`)

    // Test 6c: stat with invalid commit
    await expect(
      brain.vfs.stat('/test.md', { commitId: fakeCommitId })
    ).rejects.toThrow('Invalid commit ID')
    console.log(`   ✅ stat throws on invalid commit`)

    // Test 6d: exists with invalid commit (returns false, doesn't throw)
    const exists = await brain.vfs.exists('/test.md', { commitId: fakeCommitId })
    expect(exists).toBe(false)
    console.log(`   ✅ exists returns false on invalid commit (doesn't throw)`)
  })

  it('should maintain performance at scale', async () => {
    console.log('\n⚡ Test 7: Performance with multiple files')

    // Create multiple files
    const fileCount = 50  // Reasonable for integration test
    for (let i = 0; i < fileCount; i++) {
      await brain.vfs.writeFile(`/perf-test-${i}.txt`, `File ${i} content`)
    }

    // Commit: Many files
    await brain.commit({
      message: 'Added 50 files for performance test',
      author: 'test@example.com'
    })
    const history = await brain.getHistory({ limit: 1 })
    const perfCommit = history[0].hash
    console.log(`   Performance commit: ${perfCommit.slice(0, 8)}`)

    // Test 7a: Historical readdir performance
    const startReaddir = Date.now()
    const entries = await brain.vfs.readdir('/', { commitId: perfCommit })
    const readdirTime = Date.now() - startReaddir

    expect(entries.length).toBeGreaterThanOrEqual(fileCount)
    console.log(`   ✅ readdir (${entries.length} entries): ${readdirTime}ms`)
    expect(readdirTime).toBeLessThan(5000)  // Should complete in < 5s

    // Test 7b: Historical readFile performance
    const startReadFile = Date.now()
    const content = await brain.vfs.readFile('/perf-test-25.txt', { commitId: perfCommit })
    const readFileTime = Date.now() - startReadFile

    expect(content.toString()).toBe('File 25 content')
    console.log(`   ✅ readFile: ${readFileTime}ms`)
    expect(readFileTime).toBeLessThan(1000)  // Should complete in < 1s

    // Test 7c: Historical exists performance
    const startExists = Date.now()
    const exists = await brain.vfs.exists('/perf-test-25.txt', { commitId: perfCommit })
    const existsTime = Date.now() - startExists

    expect(exists).toBe(true)
    console.log(`   ✅ exists: ${existsTime}ms`)
    expect(existsTime).toBeLessThan(1000)  // Should complete in < 1s
  })

  it('should work with nested directory structures', async () => {
    console.log('\n🌲 Test 8: Nested directories at historical commits')

    // Create nested structure
    await brain.vfs.mkdir('/deep')
    await brain.vfs.mkdir('/deep/level1')
    await brain.vfs.mkdir('/deep/level1/level2')
    await brain.vfs.writeFile('/deep/level1/level2/deep-file.txt', 'Deep content')

    // Commit: Deep structure
    await brain.commit({
      message: 'Added deep directory structure',
      author: 'test@example.com'
    })
    const history1 = await brain.getHistory({ limit: 1 })
    const deepCommit = history1[0].hash
    console.log(`   Deep structure commit: ${deepCommit.slice(0, 8)}`)

    // Test 8a: Read deep file
    const content = await brain.vfs.readFile('/deep/level1/level2/deep-file.txt', {
      commitId: deepCommit
    })
    expect(content.toString()).toBe('Deep content')
    console.log(`   ✅ Read file from nested directory`)

    // Test 8b: List intermediate directory
    const level1Entries = await brain.vfs.readdir('/deep/level1', { commitId: deepCommit })
    expect(level1Entries).toContain('level2')
    console.log(`   ✅ List intermediate directory`)

    // Test 8c: Stat deep directory
    const dirStats = await brain.vfs.stat('/deep/level1/level2', { commitId: deepCommit })
    expect(dirStats.isDirectory()).toBe(true)
    console.log(`   ✅ Stat nested directory`)

    // Test 8d: Check existence of deep path
    const exists = await brain.vfs.exists('/deep/level1/level2/deep-file.txt', {
      commitId: deepCommit
    })
    expect(exists).toBe(true)
    console.log(`   ✅ Check existence of deep path`)
  })
})
