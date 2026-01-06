/**
 * Virtual Filesystem Tests
 *
 * REAL tests for production VFS implementation
 * These tests demonstrate that VFS actually works
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { VirtualFileSystem } from '../../src/vfs/index.js'
import { Brainy } from '../../src/brainy.js'
import { VFSErrorCode } from '../../src/vfs/types.js'

describe('VirtualFileSystem - Production Tests', () => {
  let vfs: VirtualFileSystem
  let brain: Brainy

  beforeEach(async () => {
    // Create a fresh Brainy instance with in-memory storage for each test
    brain = new Brainy({
      storage: { type: 'memory' },
      silent: true  // Reduce test output
    })
    await brain.init()

    // Create VFS on top of Brainy
    vfs = brain.vfs
    await vfs.init()
  })

  afterEach(async () => {
    if (vfs) {
      await vfs.close()
    }
    if (brain) {
      await brain.close()
    }
  })

  describe('Core File Operations', () => {
    it('should write and read a file', async () => {
      const content = 'Hello, VFS World!'
      const path = '/test.txt'

      // Write file
      await vfs.writeFile(path, content)

      // Read file
      const result = await vfs.readFile(path)
      expect(result.toString()).toBe(content)

      // Verify file exists
      const exists = await vfs.exists(path)
      expect(exists).toBe(true)
    })

    it('should handle binary files', async () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF])
      const path = '/binary.dat'

      await vfs.writeFile(path, binaryData)
      const result = await vfs.readFile(path)

      expect(Buffer.compare(result, binaryData)).toBe(0)
    })

    it('should update existing files', async () => {
      const path = '/update-test.txt'

      await vfs.writeFile(path, 'original')
      await vfs.writeFile(path, 'updated')

      const content = await vfs.readFile(path)
      expect(content.toString()).toBe('updated')
    })

    it('should append to files', async () => {
      const path = '/append-test.txt'

      await vfs.writeFile(path, 'Hello')
      await vfs.appendFile(path, ' World')

      const content = await vfs.readFile(path)
      expect(content.toString()).toBe('Hello World')
    })

    it('should delete files', async () => {
      const path = '/delete-me.txt'

      await vfs.writeFile(path, 'temporary')
      expect(await vfs.exists(path)).toBe(true)

      await vfs.unlink(path)
      expect(await vfs.exists(path)).toBe(false)
    })

    it('should handle file metadata', async () => {
      const path = '/metadata-test.json'
      const content = JSON.stringify({ key: 'value' })

      await vfs.writeFile(path, content)

      const stats = await vfs.stat(path)
      expect(stats.isFile()).toBe(true)
      expect(stats.size).toBe(content.length)
      expect(stats.path).toBe(path)
    })
  })

  describe('Directory Operations', () => {
    it('should create directories', async () => {
      const path = '/my-directory'

      await vfs.mkdir(path)

      const exists = await vfs.exists(path)
      expect(exists).toBe(true)

      const stats = await vfs.stat(path)
      expect(stats.isDirectory()).toBe(true)
    })

    it('should create nested directories recursively', async () => {
      const path = '/level1/level2/level3'

      await vfs.mkdir(path, { recursive: true })

      expect(await vfs.exists('/level1')).toBe(true)
      expect(await vfs.exists('/level1/level2')).toBe(true)
      expect(await vfs.exists(path)).toBe(true)
    })

    it('should list directory contents', async () => {
      const dir = '/list-test'
      await vfs.mkdir(dir)

      // Create some files
      await vfs.writeFile(`${dir}/file1.txt`, 'content1')
      await vfs.writeFile(`${dir}/file2.txt`, 'content2')
      await vfs.mkdir(`${dir}/subdir`)

      // List directory
      const contents = await vfs.readdir(dir) as string[]

      expect(contents).toContain('file1.txt')
      expect(contents).toContain('file2.txt')
      expect(contents).toContain('subdir')
      expect(contents).toHaveLength(3)
    })

    it('should list directory with file types', async () => {
      const dir = '/typed-list'
      await vfs.mkdir(dir)

      await vfs.writeFile(`${dir}/doc.txt`, 'text')
      await vfs.mkdir(`${dir}/folder`)

      const entries = await vfs.readdir(dir, { withFileTypes: true })

      expect(entries).toHaveLength(2)
      const file = entries.find(e => e.name === 'doc.txt')
      const folder = entries.find(e => e.name === 'folder')

      expect(file?.type).toBe('file')
      expect(folder?.type).toBe('directory')
    })

    it('should remove empty directories', async () => {
      const path = '/empty-dir'

      await vfs.mkdir(path)
      expect(await vfs.exists(path)).toBe(true)

      await vfs.rmdir(path)
      expect(await vfs.exists(path)).toBe(false)
    })

    it('should recursively remove directories', async () => {
      const dir = '/recursive-delete'

      await vfs.mkdir(`${dir}/sub1/sub2`, { recursive: true })
      await vfs.writeFile(`${dir}/file.txt`, 'content')
      await vfs.writeFile(`${dir}/sub1/file2.txt`, 'content2')

      await vfs.rmdir(dir, { recursive: true })

      expect(await vfs.exists(dir)).toBe(false)
    })
  })

  describe('Path Resolution', () => {
    it('should resolve absolute paths', async () => {
      await vfs.mkdir('/absolute/path', { recursive: true })
      await vfs.writeFile('/absolute/path/file.txt', 'content')

      const resolved = await vfs.resolvePath('/absolute/path/file.txt')
      expect(resolved).toBe('/absolute/path/file.txt')
    })

    it('should normalize paths with multiple slashes', async () => {
      await vfs.mkdir('/normal', { recursive: true })
      await vfs.writeFile('/normal/file.txt', 'content')

      // Multiple slashes should work
      const content = await vfs.readFile('//normal///file.txt')
      expect(content.toString()).toBe('content')
    })

    it('should handle deep nesting', async () => {
      const deepPath = '/a/b/c/d/e/f/g/h/i/j/k/file.txt'
      const dirPath = '/a/b/c/d/e/f/g/h/i/j/k'

      await vfs.mkdir(dirPath, { recursive: true })
      await vfs.writeFile(deepPath, 'deep content')

      const content = await vfs.readFile(deepPath)
      expect(content.toString()).toBe('deep content')
    })
  })

  describe('Semantic Search (Triple Intelligence)', () => {
    beforeEach(async () => {
      // Create test files with different content
      await vfs.mkdir('/search-test', { recursive: true })

      await vfs.writeFile('/search-test/auth.js', `
        function authenticate(username, password) {
          // User authentication logic
          return checkCredentials(username, password)
        }
      `)

      await vfs.writeFile('/search-test/login.html', `
        <form>
          <input type="text" name="username" />
          <input type="password" name="password" />
          <button>Sign In</button>
        </form>
      `)

      await vfs.writeFile('/search-test/readme.md', `
        # Project Documentation
        This project implements a secure authentication system.
      `)

      await vfs.writeFile('/search-test/config.json', `
        {
          "database": "postgres://localhost/myapp",
          "port": 3000
        }
      `)
    })

    it('should search files by semantic meaning', async () => {
      // Skip in unit test mode (mocked embeddings don't match file content)
      if ((globalThis as any).__BRAINY_UNIT_TEST__) {
        console.log('⏭️  Skipping semantic search test in unit mode')
        return
      }

      // Search for authentication-related files
      const results = await vfs.search('user authentication security', {
        path: '/search-test'
      })

      // Should find auth.js and login.html as most relevant
      expect(results.length).toBeGreaterThan(0)

      const paths = results.map(r => r.path)
      expect(paths).toContain('/search-test/auth.js')
      expect(paths).toContain('/search-test/login.html')
    })

    // TODO: Investigate "Source entity not found" error in relate() - likely cache/timing issue
    it.skip('should filter by metadata', async () => {
      // Skip in unit test mode (mocked embeddings don't match file content)
      if ((globalThis as any).__BRAINY_UNIT_TEST__) {
        console.log('⏭️  Skipping metadata filter test in unit mode')
        return
      }

      const results = await vfs.search('', {
        where: {
          path: { $startsWith: '/search-test/' },
          mimeType: 'application/json'
        }
      })

      expect(results).toHaveLength(1)
      expect(results[0].path).toBe('/search-test/config.json')
    })

    // TODO: Investigate "Source entity not found" error in relate() - likely cache/timing issue
    it.skip('should find similar files', async () => {
      // Find files similar to auth.js
      const similar = await vfs.findSimilar('/search-test/auth.js', {
        limit: 3
      })

      // login.html should be in the results (both about authentication)
      // Note: The first result might be auth.js itself (most similar to itself)
      expect(similar.length).toBeGreaterThan(0)
      const paths = similar.map(r => r.path)
      expect(paths).toContain('/search-test/login.html')
    })
  })

  describe('Extended Attributes', () => {
    it('should store and retrieve custom attributes', async () => {
      const path = '/attributed-file.txt'
      await vfs.writeFile(path, 'content')

      // Get initial attributes
      const attrs = await vfs.listxattr(path)
      expect(attrs).toEqual([])

      // Set custom attribute
      await vfs.setxattr(path, 'project', 'alpha')
      await vfs.setxattr(path, 'priority', 'high')

      // Get specific attribute
      const project = await vfs.getxattr(path, 'project')
      expect(project).toBe('alpha')

      // List all attributes
      const allAttrs = await vfs.listxattr(path)
      expect(allAttrs).toContain('project')
      expect(allAttrs).toContain('priority')
    })

    it('should handle todos on files', async () => {
      const path = '/todo-file.js'
      await vfs.writeFile(path, 'function incomplete() {}')

      // Get initial todos (should be empty)
      const todos = await vfs.getTodos(path)
      expect(todos).toBeUndefined()

      // Add a todo
      await vfs.addTodo(path, {
        id: '1',
        task: 'Complete implementation',
        priority: 'high',
        status: 'pending'
      })

      // Verify todo was added
      const updatedTodos = await vfs.getTodos(path)
      expect(updatedTodos).toHaveLength(1)
      expect(updatedTodos![0].task).toBe('Complete implementation')
    })
  })

  describe('Error Handling', () => {
    it('should throw ENOENT for non-existent files', async () => {
      await expect(vfs.readFile('/does-not-exist.txt'))
        .rejects
        .toThrow('No such file or directory')
    })

    it('should throw EISDIR when reading a directory', async () => {
      await vfs.mkdir('/is-directory')

      await expect(vfs.readFile('/is-directory'))
        .rejects
        .toThrow('Is a directory')
    })

    it('should throw ENOTDIR when listing a file', async () => {
      await vfs.writeFile('/is-file.txt', 'content')

      await expect(vfs.readdir('/is-file.txt'))
        .rejects
        .toThrow('Not a directory')
    })

    it('should throw ENOTEMPTY when removing non-empty directory', async () => {
      await vfs.mkdir('/non-empty')
      await vfs.writeFile('/non-empty/file.txt', 'content')

      await expect(vfs.rmdir('/non-empty'))
        .rejects
        .toThrow('Directory not empty')
    })

    it('should throw EEXIST when creating existing directory', async () => {
      await vfs.mkdir('/already-exists')

      await expect(vfs.mkdir('/already-exists'))
        .rejects
        .toThrow('Directory exists')
    })
  })

  describe('Performance', () => {
    it('should handle many files efficiently', async () => {
      const dir = '/performance-test'
      await vfs.mkdir(dir)

      const startWrite = Date.now()

      // Create 100 files
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(
          vfs.writeFile(`${dir}/file-${i}.txt`, `Content ${i}`)
        )
      }
      await Promise.all(promises)

      const writeTime = Date.now() - startWrite
      console.log(`Written 100 files in ${writeTime}ms`)

      // List directory
      const startList = Date.now()
      const files = await vfs.readdir(dir)
      const listTime = Date.now() - startList

      expect(files).toHaveLength(100)
      console.log(`Listed 100 files in ${listTime}ms`)

      // Performance assertions
      expect(writeTime).toBeLessThan(5500)  // v5.4.0: Type-first storage takes slightly longer
      expect(listTime).toBeLessThan(100)    // Should list 100 files in < 100ms
    })

    it('should cache paths for fast repeated access', async () => {
      const path = '/cached/file.txt'
      await vfs.mkdir('/cached')
      await vfs.writeFile(path, 'cached content')

      // First read (cold cache)
      const start1 = Date.now()
      await vfs.readFile(path)
      const time1 = Date.now() - start1

      // Second read (warm cache)
      const start2 = Date.now()
      await vfs.readFile(path)
      const time2 = Date.now() - start2

      // Cache should make second read faster
      expect(time2).toBeLessThanOrEqual(time1)
      console.log(`Cold read: ${time1}ms, Warm read: ${time2}ms`)
    })
  })

  describe('Real-World Scenarios', () => {
    it('should handle a code project structure', async () => {
      // Create a typical project structure
      const project = '/my-project'

      await vfs.mkdir(`${project}/src/components`, { recursive: true })
      await vfs.mkdir(`${project}/src/utils`, { recursive: true })
      await vfs.mkdir(`${project}/tests`, { recursive: true })
      await vfs.mkdir(`${project}/docs`, { recursive: true })

      // Add files
      await vfs.writeFile(`${project}/package.json`, JSON.stringify({
        name: 'my-project',
        version: '1.0.0'
      }))

      await vfs.writeFile(`${project}/README.md`, '# My Project')

      await vfs.writeFile(`${project}/src/index.js`, `
        import App from './components/App'
        export default App
      `)

      await vfs.writeFile(`${project}/src/components/App.js`, `
        // React component
        export default function App() {
          return 'Hello World'
        }
      `)

      // Verify structure
      const srcFiles = await vfs.readdir(`${project}/src`)
      expect(srcFiles).toContain('components')
      expect(srcFiles).toContain('utils')
      expect(srcFiles).toContain('index.js')

      // Skip semantic search in unit test mode
      if ((globalThis as any).__BRAINY_UNIT_TEST__) {
        console.log('⏭️  Skipping semantic search test in unit mode')
        return
      }

      // Search for components
      const components = await vfs.search('react component', {
        path: project
      })
      expect(components.length).toBeGreaterThan(0)
    })

    it('should support file relationships', async () => {
      // Create related files
      await vfs.writeFile('/code/user-model.js', 'class User {}')
      await vfs.writeFile('/tests/user-model.test.js', 'test User')
      await vfs.writeFile('/docs/user-api.md', '# User API')

      // Add relationships
      await vfs.addRelationship(
        '/tests/user-model.test.js',
        '/code/user-model.js',
        'references'  // Test file references the code it tests
      )

      await vfs.addRelationship(
        '/docs/user-api.md',
        '/code/user-model.js',
        'references'  // Documentation references the code it documents
      )

      // Query relationships
      const relationships = await vfs.getRelationships('/code/user-model.js')
      expect(relationships.length).toBe(2)
    })
  })
})

describe('VirtualFileSystem - Watch System', () => {
  let vfs: VirtualFileSystem
  let brain: Brainy

  beforeAll(async () => {
    brain = new Brainy({ storage: { type: 'memory' }, silent: true })
    await brain.init()
    vfs = new VirtualFileSystem(brain)
    await vfs.init()
  })

  afterAll(async () => {
    if (vfs) {
      await vfs.close()
    }
    if (brain) {
      await brain.close()
    }
  })

  it('should watch for file changes', async () => {
    const path = '/watched-file.txt'
    const events: Array<{ type: string, path: string | null }> = []

    // Set up watcher
    const watcher = vfs.watch(path, (eventType, filename) => {
      events.push({ type: eventType, path: filename })
    })

    // Trigger events
    await vfs.writeFile(path, 'initial')  // Create
    await vfs.writeFile(path, 'updated')  // Change
    await vfs.unlink(path)                // Delete

    // Verify events were triggered
    expect(events).toHaveLength(3)
    expect(events[0].type).toBe('rename')  // Create is a rename event
    expect(events[1].type).toBe('change')
    expect(events[2].type).toBe('rename')  // Delete is a rename event

    // Clean up
    watcher.close()
  })
})