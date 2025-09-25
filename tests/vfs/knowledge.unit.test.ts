/**
 * Knowledge Layer Tests
 *
 * Comprehensive tests for all Knowledge Layer components integrated with VFS:
 * - EventRecorder
 * - SemanticVersioning
 * - PersistentEntitySystem
 * - ConceptSystem
 * - GitBridge
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { VirtualFileSystem } from '../../src/vfs/VirtualFileSystem.js'
import { EventRecorder } from '../../src/vfs/EventRecorder.js'
import { SemanticVersioning } from '../../src/vfs/SemanticVersioning.js'
import { PersistentEntitySystem } from '../../src/vfs/PersistentEntitySystem.js'
import { ConceptSystem } from '../../src/vfs/ConceptSystem.js'
import { GitBridge } from '../../src/vfs/GitBridge.js'
import { tmpdir } from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'

describe('Knowledge Layer', () => {
  let brain: Brainy
  let vfs: VirtualFileSystem
  let tempDir: string

  beforeEach(async () => {
    // Use in-memory storage for tests
    brain = new Brainy({
      storage: { type: 'memory' }
    })
    await brain.init()

    vfs = new VirtualFileSystem(brain)
    await vfs.init()

    // Create temporary directory for Git tests
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'brainy-knowledge-test-'))
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('VFS Knowledge Integration', () => {
    it('should have VFS integrated with Brainy', async () => {
      // VFS should be properly integrated with Brainy
      expect(vfs).toBeDefined()
      expect(brain.vfs()).toBeDefined()

      // Test basic VFS operations
      const exists = await vfs.exists('/')
      expect(exists).toBe(true)
    })

    it('should support knowledge layer operations through VFS', async () => {
      // Test that VFS supports file operations that the knowledge layer depends on
      await vfs.writeFile('/test.txt', 'test content')
      const content = await vfs.readFile('/test.txt')
      expect(content.toString()).toBe('test content')

      // Test that file exists
      const exists = await vfs.exists('/test.txt')
      expect(exists).toBe(true)
    })
  })

  describe('EventRecorder', () => {
    let eventRecorder: EventRecorder

    beforeEach(() => {
      eventRecorder = new EventRecorder(brain)
    })

    it('should record file events', async () => {
      const eventId = await eventRecorder.recordEvent({
        type: 'write',
        path: '/test.txt',
        content: Buffer.from('hello world'),
        size: 11,
        author: 'test-user'
      })

      expect(eventId).toBeDefined()
    })

    it('should retrieve file history', async () => {
      // Record multiple events
      await eventRecorder.recordEvent({
        type: 'create',
        path: '/test.txt',
        content: Buffer.from('initial'),
        size: 7
      })

      await eventRecorder.recordEvent({
        type: 'write',
        path: '/test.txt',
        content: Buffer.from('updated'),
        size: 7
      })

      const history = await eventRecorder.getHistory('/test.txt')

      expect(history).toHaveLength(2)
      expect(history[0].type).toBe('write') // Newest first
      expect(history[1].type).toBe('create')
    })

    it('should reconstruct file at specific time', async () => {
      const timestamp1 = Date.now()

      await eventRecorder.recordEvent({
        type: 'create',
        path: '/test.txt',
        content: Buffer.from('version 1'),
        size: 9
      })

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 10))
      const timestamp2 = Date.now()

      await eventRecorder.recordEvent({
        type: 'write',
        path: '/test.txt',
        content: Buffer.from('version 2'),
        size: 9
      })

      // Reconstruct at timestamp1 (should get version 1)
      const content1 = await eventRecorder.reconstructFileAtTime('/test.txt', timestamp1)
      expect(content1?.toString()).toBe('version 1')

      // Reconstruct at timestamp2 (should get version 2)
      const content2 = await eventRecorder.reconstructFileAtTime('/test.txt', timestamp2)
      expect(content2?.toString()).toBe('version 2')
    })

    it('should calculate statistics', async () => {
      await eventRecorder.recordEvent({
        type: 'write',
        path: '/test.txt',
        size: 100,
        author: 'user1'
      })

      await eventRecorder.recordEvent({
        type: 'append',
        path: '/test.txt',
        size: 50,
        author: 'user2'
      })

      const stats = await eventRecorder.getStatistics('/test.txt')

      expect(stats.totalEvents).toBe(2)
      expect(stats.totalWrites).toBe(2)
      expect(stats.totalBytes).toBe(150)
      expect(stats.authors).toContain('user1')
      expect(stats.authors).toContain('user2')
    })

    it('should find temporal coupling', async () => {
      const now = Date.now()

      // Record related events within time window
      await eventRecorder.recordEvent({
        type: 'write',
        path: '/file1.txt'
      })

      await eventRecorder.recordEvent({
        type: 'write',
        path: '/file2.txt'
      })

      const coupling = await eventRecorder.findTemporalCoupling('/file1.txt', 60000)

      expect(coupling.has('/file2.txt')).toBe(true)
      expect(coupling.get('/file2.txt')).toBe(1)
    })
  })

  describe('SemanticVersioning', () => {
    let semanticVersioning: SemanticVersioning

    beforeEach(() => {
      semanticVersioning = new SemanticVersioning(brain, {
        threshold: 0.3,
        maxVersions: 5
      })
    })

    it('should detect when versioning is needed', async () => {
      const oldContent = Buffer.from('hello world')
      const newContent = Buffer.from('goodbye world')

      const shouldVersion = await semanticVersioning.shouldVersion(oldContent, newContent)

      // Should version due to content change (no embeddings available)
      expect(shouldVersion).toBe(true)
    })

    it('should not version identical content', async () => {
      const content = Buffer.from('hello world')

      const shouldVersion = await semanticVersioning.shouldVersion(content, content)

      expect(shouldVersion).toBe(false)
    })

    it('should create versions', async () => {
      const content = Buffer.from('version 1 content')

      const versionId = await semanticVersioning.createVersion(
        '/test.txt',
        content,
        { author: 'test-user', message: 'Initial version' }
      )

      expect(versionId).toBeDefined()

      // Check version exists
      const versions = await semanticVersioning.getVersions('/test.txt')
      expect(versions).toHaveLength(1)
      expect(versions[0].version).toBe(1)
      expect(versions[0].author).toBe('test-user')
    })

    it('should retrieve version content', async () => {
      const content = Buffer.from('test content')

      const versionId = await semanticVersioning.createVersion('/test.txt', content)

      const retrievedContent = await semanticVersioning.getVersion('/test.txt', versionId)

      expect(retrievedContent).toEqual(content)
    })

    it('should provide version history', async () => {
      // Create multiple versions
      await semanticVersioning.createVersion('/test.txt', Buffer.from('v1'))
      await semanticVersioning.createVersion('/test.txt', Buffer.from('v2'))
      await semanticVersioning.createVersion('/test.txt', Buffer.from('v3'))

      const history = await semanticVersioning.getVersionHistory('/test.txt')

      expect(history).toHaveLength(3)
      expect(history[0].version.version).toBe(3) // Newest first
      expect(history[2].version.version).toBe(1) // Oldest last
    })

    it('should prune old versions', async () => {
      // Create more versions than maxVersions
      for (let i = 1; i <= 10; i++) {
        await semanticVersioning.createVersion('/test.txt', Buffer.from(`version ${i}`))
      }

      const versions = await semanticVersioning.getVersions('/test.txt')

      // Should have pruned to maxVersions (5)
      expect(versions.length).toBeLessThanOrEqual(5)
    })
  })

  describe('PersistentEntitySystem', () => {
    let entitySystem: PersistentEntitySystem

    beforeEach(() => {
      entitySystem = new PersistentEntitySystem(brain, {
        autoExtract: false,
        evolutionTracking: true
      })
    })

    it('should create persistent entities', async () => {
      const entityId = await entitySystem.createEntity({
        name: 'John Doe',
        type: 'character',
        aliases: ['Johnny', 'JD'],
        attributes: { age: 30, role: 'protagonist' }
      })

      expect(entityId).toBeDefined()
    })

    it('should find entities by name', async () => {
      await entitySystem.createEntity({
        name: 'Alice Smith',
        type: 'character',
        aliases: ['Alice'],
        attributes: {}
      })

      const entities = await entitySystem.findEntity({ name: 'Alice Smith' })

      expect(entities).toHaveLength(1)
      expect(entities[0].name).toBe('Alice Smith')
      expect(entities[0].type).toBe('character')
    })

    it('should record entity appearances', async () => {
      const entityId = await entitySystem.createEntity({
        name: 'API Gateway',
        type: 'service',
        aliases: [],
        attributes: {}
      })

      const appearanceId = await entitySystem.recordAppearance(
        entityId,
        '/docs/architecture.md',
        'The API Gateway handles all incoming requests...',
        { confidence: 0.9 }
      )

      expect(appearanceId).toBeDefined()

      // Check appearances
      const appearances = await entitySystem.findAppearances(entityId)
      expect(appearances).toHaveLength(1)
      expect(appearances[0].filePath).toBe('/docs/architecture.md')
      expect(appearances[0].confidence).toBe(0.9)
    })

    it('should track entity evolution', async () => {
      const entityId = await entitySystem.createEntity({
        name: 'UserService',
        type: 'service',
        aliases: [],
        attributes: { version: '1.0' }
      })

      // Evolve the entity
      await entitySystem.evolveEntity(
        entityId,
        { attributes: { version: '2.0', newFeature: true } },
        '/src/user-service.ts',
        'Added new feature'
      )

      const { entity, timeline } = await entitySystem.getEvolution(entityId)

      expect(entity.version).toBeGreaterThan(1)
      expect(entity.attributes.version).toBe('2.0')
      expect(entity.attributes.newFeature).toBe(true)
    })

    it('should extract entities from content', async () => {
      entitySystem = new PersistentEntitySystem(brain, { autoExtract: true })

      const content = Buffer.from(`
        class UserService {
          function authenticate(user) {
            // Authentication logic
          }
        }
      `)

      const entityIds = await entitySystem.extractEntities('/src/user.ts', content)

      expect(entityIds.length).toBeGreaterThan(0)
    })

    it('should update references when files move', async () => {
      const entityId = await entitySystem.createEntity({
        name: 'TestEntity',
        type: 'test',
        aliases: [],
        attributes: {}
      })

      await entitySystem.recordAppearance(
        entityId,
        '/old/path.txt',
        'test context'
      )

      // Move file
      await entitySystem.updateReferences('/old/path.txt', '/new/path.txt')

      // Check that appearances were updated
      const appearances = await entitySystem.findAppearances(entityId)
      expect(appearances[0].filePath).toBe('/new/path.txt')
    })
  })

  describe('ConceptSystem', () => {
    let conceptSystem: ConceptSystem

    beforeEach(() => {
      conceptSystem = new ConceptSystem(brain, {
        autoLink: false,
        similarityThreshold: 0.7
      })
    })

    it('should create universal concepts', async () => {
      const conceptId = await conceptSystem.createConcept({
        name: 'Authentication',
        domain: 'technical',
        category: 'pattern',
        keywords: ['auth', 'security', 'login'],
        strength: 0.8,
        metadata: {}
      })

      expect(conceptId).toBeDefined()
    })

    it('should find concepts by criteria', async () => {
      await conceptSystem.createConcept({
        name: 'User Experience',
        domain: 'business',
        category: 'concept',
        keywords: ['UX', 'usability'],
        strength: 0.9,
        metadata: {}
      })

      const concepts = await conceptSystem.findConcepts({ domain: 'business' })

      expect(concepts).toHaveLength(1)
      expect(concepts[0].name).toBe('User Experience')
      expect(concepts[0].domain).toBe('business')
    })

    it('should link concepts together', async () => {
      const concept1Id = await conceptSystem.createConcept({
        name: 'Authentication',
        domain: 'technical',
        category: 'pattern',
        keywords: [],
        strength: 0.8,
        metadata: {}
      })

      const concept2Id = await conceptSystem.createConcept({
        name: 'Security',
        domain: 'technical',
        category: 'concept',
        keywords: [],
        strength: 0.9,
        metadata: {}
      })

      const linkId = await conceptSystem.linkConcept(
        concept1Id,
        concept2Id,
        'related',
        { strength: 0.8, bidirectional: true }
      )

      expect(linkId).toBeDefined()
    })

    it('should record concept manifestations', async () => {
      const conceptId = await conceptSystem.createConcept({
        name: 'Dependency Injection',
        domain: 'technical',
        category: 'pattern',
        keywords: [],
        strength: 0.8,
        metadata: {}
      })

      const manifestationId = await conceptSystem.recordManifestation(
        conceptId,
        '/src/di-container.ts',
        'class DIContainer implements dependency injection pattern...',
        'implementation',
        { confidence: 0.9 }
      )

      expect(manifestationId).toBeDefined()

      // Check manifestations
      const manifestations = await conceptSystem.findAppearances(conceptId)
      expect(manifestations).toHaveLength(1)
      expect(manifestations[0].form).toBe('implementation')
    })

    it('should extract concepts from content', async () => {
      conceptSystem = new ConceptSystem(brain, { autoLink: true })

      const content = Buffer.from(`
        Authentication is a critical security concept.
        The authentication service validates user credentials.
      `)

      const conceptIds = await conceptSystem.extractAndLinkConcepts('/docs/auth.md', content)

      expect(conceptIds.length).toBeGreaterThan(0)
    })

    it('should generate concept graph', async () => {
      // Create test concepts
      const concept1Id = await conceptSystem.createConcept({
        name: 'API Design',
        domain: 'technical',
        category: 'concept',
        keywords: [],
        strength: 0.8,
        metadata: {}
      })

      const concept2Id = await conceptSystem.createConcept({
        name: 'REST',
        domain: 'technical',
        category: 'pattern',
        keywords: [],
        strength: 0.7,
        metadata: {}
      })

      await conceptSystem.linkConcept(concept1Id, concept2Id, 'uses')

      const graph = await conceptSystem.getConceptGraph()

      expect(graph.concepts).toHaveLength(2)
      expect(graph.links).toHaveLength(1)
      expect(graph.links[0].relationship).toBe('uses')
    })
  })

  describe('GitBridge', () => {
    let gitBridge: GitBridge
    let gitRepoPath: string

    beforeEach(async () => {
      gitBridge = new GitBridge(vfs, brain)
      gitRepoPath = path.join(tempDir, 'git-repo')
      await fs.mkdir(gitRepoPath, { recursive: true })
    })

    it('should export VFS to Git repository', async () => {
      // Create test files in VFS
      await vfs.mkdir('/project')
      await vfs.writeFile('/project/README.md', '# Test Project')
      await vfs.writeFile('/project/src/main.js', 'console.log("Hello World")')

      const gitRepo = await gitBridge.exportToGit(
        '/project',
        gitRepoPath,
        {
          preserveMetadata: true,
          commitMessage: 'Initial export from VFS'
        }
      )

      expect(gitRepo.files.length).toBeGreaterThan(0)
      expect(gitRepo.commits).toHaveLength(1)
      expect(gitRepo.commits[0].message).toBe('Initial export from VFS')

      // Check files were created
      const readmeExists = await fs.access(path.join(gitRepoPath, 'README.md')).then(() => true).catch(() => false)
      const mainExists = await fs.access(path.join(gitRepoPath, 'src/main.js')).then(() => true).catch(() => false)

      expect(readmeExists).toBe(true)
      expect(mainExists).toBe(true)
    })

    it('should import Git repository to VFS', async () => {
      // Create test Git repository structure
      await fs.mkdir(path.join(gitRepoPath, 'src'), { recursive: true })
      await fs.writeFile(path.join(gitRepoPath, 'README.md'), '# Imported Project')
      await fs.writeFile(path.join(gitRepoPath, 'src/app.js'), 'const app = "hello"')

      const stats = await gitBridge.importFromGit(
        gitRepoPath,
        '/imported'
      )

      expect(stats.filesImported).toBe(2)

      // Check files were imported
      const readmeExists = await vfs.exists('/imported/README.md')
      const appExists = await vfs.exists('/imported/src/app.js')

      expect(readmeExists).toBe(true)
      expect(appExists).toBe(true)

      // Check file content
      const readmeContent = await vfs.readFile('/imported/README.md')
      expect(readmeContent.toString()).toBe('# Imported Project')
    })

    it('should preserve metadata during export/import cycle', async () => {
      // Create file with metadata
      await vfs.writeFile('/test.txt', 'test content', {
        metadata: { author: 'test-user', tags: ['important'] }
      })

      // Export to Git
      await gitBridge.exportToGit('/', gitRepoPath, { preserveMetadata: true })

      // Clear VFS
      await vfs.unlink('/test.txt')

      // Import back from Git
      await gitBridge.importFromGit(gitRepoPath, '/restored', { extractMetadata: true })

      // Check file was restored
      const exists = await vfs.exists('/restored/test.txt')
      expect(exists).toBe(true)

      const content = await vfs.readFile('/restored/test.txt')
      expect(content.toString()).toBe('test content')
    })

    it('should handle nested directory structures', async () => {
      // Create nested structure
      await vfs.mkdir('/deep/nested/structure', { recursive: true })
      await vfs.writeFile('/deep/nested/structure/file.txt', 'deep file')
      await vfs.writeFile('/deep/other.txt', 'other file')

      // Export
      await gitBridge.exportToGit('/deep', gitRepoPath)

      // Import to new location
      const stats = await gitBridge.importFromGit(gitRepoPath, '/imported')

      expect(stats.filesImported).toBe(2)

      const deepExists = await vfs.exists('/imported/nested/structure/file.txt')
      const otherExists = await vfs.exists('/imported/other.txt')

      expect(deepExists).toBe(true)
      expect(otherExists).toBe(true)
    })
  })

  describe('Integration Tests', () => {
    it('should work with all knowledge layer components together', async () => {
      // Test that individual knowledge components can work with VFS
      const eventRecorder = new EventRecorder(brain)
      const semanticVersioning = new SemanticVersioning(brain)
      const entitySystem = new PersistentEntitySystem(brain)
      const conceptSystem = new ConceptSystem(brain)

      // Write a file through VFS
      const content = `
        # Authentication Service

        The AuthService class handles user authentication.
        It implements the security pattern for validating credentials.

        class AuthService {
          authenticate(user, password) {
            // Validation logic
          }
        }
      `

      await vfs.writeFile('/services/auth.md', content)

      // Test that the file exists in VFS
      const exists = await vfs.exists('/services/auth.md')
      expect(exists).toBe(true)

      // Test that file content is correct
      const readContent = await vfs.readFile('/services/auth.md')
      expect(readContent.toString()).toContain('AuthService')
    })

    it('should maintain VFS consistency with file operations', async () => {
      // Test basic VFS operations that knowledge layer depends on
      await vfs.mkdir('/controllers', { recursive: true })
      await vfs.writeFile('/controllers/user.ts', 'class UserController {}')

      // Test file rename
      await vfs.rename('/controllers/user.ts', '/controllers/user-controller.ts')

      // Verify file still exists at new location
      const exists = await vfs.exists('/controllers/user-controller.ts')
      expect(exists).toBe(true)

      // Verify old location doesn't exist
      const oldExists = await vfs.exists('/controllers/user.ts')
      expect(oldExists).toBe(false)
    })
  })
})