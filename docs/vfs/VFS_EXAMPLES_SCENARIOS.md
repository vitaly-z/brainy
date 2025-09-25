# VFS Examples and Scenarios

## Real-World Scenarios

This document demonstrates how VFS with Knowledge Layer enables powerful real-world applications.

### Legend
- ✅ **Real VFS methods** - Fully implemented and working
- 📝 **User functions** - Templates available in [USER_FUNCTIONS.md](./USER_FUNCTIONS.md)
- 🔮 **Future features** - Not yet available (AI augmentations)

**Note:** All ✅ marked methods are production-ready. For 📝 methods, see USER_FUNCTIONS.md for implementation templates.

## Scenario 1: Collaborative Novel Writing

Multiple authors working on a shared universe with recurring characters and locations.

```javascript
import { Brainy } from '@soulcraft/brainy'

async function novelWritingProject() {
  const brain = new Brainy({ storage: { type: 'file', path: './novel-data' } })
  await brain.init()

  const vfs = brain.vfs()
  await vfs.init()
  await vfs.enableKnowledgeLayer()

  // Create project structure ✅
  await vfs.mkdir('/novel')
  await vfs.mkdir('/novel/chapters')
  await vfs.mkdir('/novel/characters')
  await vfs.mkdir('/novel/worldbuilding')

  // Define main characters as persistent entities ✅
  const protagonist = await vfs.createEntity({
    name: 'Elena Blackwood',
    type: 'character',
    description: 'A skilled detective with a mysterious past',
    attributes: {
      age: 32,
      occupation: 'Private Investigator',
      skills: ['deduction', 'combat', 'languages'],
      personality: ['determined', 'secretive', 'compassionate']
    }
  })

  const antagonist = await vfs.createEntity({
    name: 'Marcus Void',
    type: 'character',
    description: 'A wealthy industrialist with dark secrets',
    attributes: {
      age: 45,
      occupation: 'CEO of Void Industries',
      traits: ['ruthless', 'charismatic', 'brilliant']
    }
  })

  // Create location entities
  const city = await vfs.createEntity({
    name: 'Neo Tokyo',
    type: 'location',
    description: 'A sprawling cyberpunk metropolis',
    attributes: {
      population: '40 million',
      districts: ['Shibuya-5', 'Crypto Quarter', 'Old Town'],
      atmosphere: 'neon-lit, rain-soaked, vertical'
    }
  })

  // Link entities ✅
  await vfs.linkEntities(protagonist.id, city.id, 'lives_in')
  await vfs.linkEntities(protagonist.id, antagonist.id, 'investigates')

  // Write chapters with automatic entity tracking
  await vfs.writeFile('/novel/chapters/chapter1.md', `
    # Chapter 1: Rain in Neo Tokyo

    Elena Blackwood stood at the edge of Shibuya-5, watching the rain cascade down
    the neon-lit towers. The case file on Marcus Void burned in her pocket.

    She had been tracking Void Industries for months, following a trail of
    disappeared scientists and mysterious experiments. Tonight, she would finally
    infiltrate the Crypto Quarter facility.
  `)

  // Multiple authors can work simultaneously ✅
  vfs.setUser('author-alice')
  await vfs.writeFile('/novel/chapters/chapter2.md', `
    # Chapter 2: The Void Industries Tower

    Marcus Void gazed down at Neo Tokyo from his penthouse office. Somewhere
    in those rain-slicked streets, Elena Blackwood was hunting him...
  `)

  vfs.setUser('author-bob')
  await vfs.appendFile('/novel/chapters/chapter2.md', `

    He smiled. Let her come. The trap was already set.
  `)

  // Track character appearances across chapters ✅
  const elenaAppearances = await vfs.findEntityOccurrences(protagonist.id)
  console.log('Elena appears in:', elenaAppearances.map(f => f.path))

  // Find all locations mentioned ✅
  const locations = await vfs.listEntities({ type: 'location' })

  // Generate character relationship graph ✅
  const relationships = await vfs.getEntityGraph(protagonist.id, { depth: 2 })

  // Track plot threads using concepts ✅
  await vfs.createConcept({
    name: 'The Void Conspiracy',
    type: 'plot',
    domain: 'narrative',
    description: 'The main mystery involving disappeared scientists',
    keywords: ['scientists', 'experiments', 'void industries', 'conspiracy']
  })

  // Find all chapters related to the conspiracy ✅
  const conspiracyChapters = await vfs.findByConcept('The Void Conspiracy')

  // Version control for revisions ✅
  const chapterVersions = await vfs.getVersions('/novel/chapters/chapter1.md')

  // Collaborative editing history ✅
  const history = await vfs.getCollaborationHistory('/novel/chapters/chapter2.md')
  console.log('Chapter 2 edited by:', history.map(h => h.user))

  // Export for publishing ✅
  const manuscript = await vfs.exportToMarkdown('/novel/chapters')

  await vfs.close()
  await brain.close()
}
```

## Scenario 2: Video Game Development

Game developers creating a complex RPG with quests, items, and NPCs.

```javascript
async function gameDevProject() {
  const brain = new Brainy({ storage: { type: 's3', bucket: 'game-assets' } })
  await brain.init()

  const vfs = brain.vfs()
  await vfs.init()
  await vfs.enableKnowledgeLayer()

  // Game project structure
  await vfs.mkdir('/game')
  await vfs.mkdir('/game/scripts')
  await vfs.mkdir('/game/assets')
  await vfs.mkdir('/game/quests')
  await vfs.mkdir('/game/npcs')
  await vfs.mkdir('/game/items')

  // Define game systems as concepts
  await vfs.createConcept({
    name: 'Combat System',
    type: 'system',
    domain: 'gameplay',
    keywords: ['damage', 'health', 'attacks', 'defense']
  })

  await vfs.createConcept({
    name: 'Quest System',
    type: 'system',
    domain: 'gameplay',
    keywords: ['objectives', 'rewards', 'dialogue', 'progression']
  })

  // Create NPC entities
  const questGiver = await vfs.createEntity({
    name: 'Elder Sage',
    type: 'npc',
    description: 'Wise old man who gives the main quest',
    attributes: {
      location: 'Village Square',
      questsOffered: ['The Ancient Artifact', 'Lost Knowledge'],
      dialogue: {
        greeting: "Welcome, young adventurer...",
        questStart: "I have a task of great importance..."
      }
    }
  })

  // Create item entities
  const artifact = await vfs.createEntity({
    name: 'Crystal of Power',
    type: 'item',
    description: 'A legendary artifact with immense magical power',
    attributes: {
      rarity: 'Legendary',
      stats: { magic: 100, wisdom: 50 },
      questItem: true,
      lore: 'Forged in the age of dragons...'
    }
  })

  // Write quest scripts
  await vfs.writeFile('/game/quests/main_quest.json', JSON.stringify({
    id: 'main_quest_01',
    name: 'The Ancient Artifact',
    description: 'Retrieve the Crystal of Power from the Dark Tower',
    objectives: [
      { id: 'obj_1', description: 'Speak to the Elder Sage' },
      { id: 'obj_2', description: 'Travel to the Dark Tower' },
      { id: 'obj_3', description: 'Defeat the Guardian' },
      { id: 'obj_4', description: 'Retrieve the Crystal of Power' }
    ],
    rewards: {
      experience: 5000,
      gold: 1000,
      items: ['Crystal of Power']
    }
  }, null, 2))

  // Link quest elements
  await vfs.linkEntities(questGiver.id, 'main_quest_01', 'gives_quest')
  await vfs.linkEntities('main_quest_01', artifact.id, 'rewards_item')

  // Combat script with system tracking
  await vfs.writeFile('/game/scripts/combat.js', `
    class CombatSystem {
      calculateDamage(attacker, defender) {
        const baseDamage = attacker.stats.attack
        const defense = defender.stats.defense
        return Math.max(1, baseDamage - defense)
      }

      executeAttack(attacker, defender) {
        const damage = this.calculateDamage(attacker, defender)
        defender.health -= damage
        return { damage, remaining: defender.health }
      }
    }

    export default CombatSystem
  `)

  // Asset management ✅
  await vfs.writeFile('/game/assets/sprites/elder_sage.png', spriteData)
  await vfs.setMetadata('/game/assets/sprites/elder_sage.png', {
    dimensions: '64x64',
    animations: ['idle', 'talking'],
    artist: 'Alice',
    license: 'CC-BY-4.0'
  })

  // Track dependencies ✅
  await vfs.addRelationship('/game/quests/main_quest.json', '/game/npcs/elder_sage.json', 'uses')
  await vfs.addRelationship('/game/scripts/combat.js', '/game/systems/stats.js', 'imports')

  // Find all content related to combat ✅
  const combatFiles = await vfs.findByConcept('Combat System')

  // Get all NPCs in a specific location ✅
  const villageNPCs = await vfs.searchEntities({
    type: 'npc',
    where: { 'attributes.location': 'Village Square' }
  })

  // Track game balance changes ✅
  const balanceHistory = await vfs.getHistory('/game/data/balance.json')

  // Collaborative development tracking ✅
  await vfs.addTodo('/game/quests/main_quest.json', {
    task: 'Add voice dialogue triggers',
    priority: 'medium',
    status: 'pending',
    assignee: 'audio-team'
  })

  // Export for build system ✅
  const gameData = await vfs.exportToJSON('/game')

  await vfs.close()
  await brain.close()
}
```

## Scenario 3: Software Development Project

Building a web application with full project management.

```javascript
async function softwareProject() {
  const brain = new Brainy({ storage: { type: 'r2', bucket: 'project-files' } })
  await brain.init()

  const vfs = brain.vfs()
  await vfs.init()
  await vfs.enableKnowledgeLayer()

  // Import existing git repository ✅ (Knowledge Layer provides wrapper)
  await vfs.importFromGit('/local/repos/webapp', '/project')

  // Define architectural concepts
  await vfs.createConcept({
    name: 'Authentication',
    type: 'architecture',
    domain: 'backend',
    keywords: ['jwt', 'login', 'session', 'oauth'],
    relatedConcepts: ['Security', 'User Management']
  })

  await vfs.createConcept({
    name: 'State Management',
    type: 'architecture',
    domain: 'frontend',
    keywords: ['redux', 'context', 'store', 'actions']
  })

  // Write source code
  await vfs.writeFile('/project/src/auth/login.ts', `
    import { User } from '../models/User'
    import { generateJWT } from '../utils/jwt'

    export async function login(email: string, password: string): Promise<string> {
      const user = await User.findByEmail(email)

      if (!user || !user.verifyPassword(password)) {
        throw new Error('Invalid credentials')
      }

      return generateJWT(user.id)
    }
  `)

  // Track imports and dependencies
  await vfs.addRelationship('/project/src/auth/login.ts', '/project/src/models/User.ts', 'imports')
  await vfs.addRelationship('/project/src/auth/login.ts', '/project/src/utils/jwt.ts', 'imports')

  // Add inline TODOs
  await vfs.addTodo('/project/src/auth/login.ts', {
    task: 'Add rate limiting',
    priority: 'high',
    status: 'pending',
    assignee: 'security-team',
    due: '2025-02-01'
  })

  await vfs.addTodo('/project/src/auth/login.ts', {
    task: 'Implement OAuth providers',
    priority: 'medium',
    status: 'in_progress',
    assignee: 'backend-team'
  })

  // Configuration files
  await vfs.writeFile('/project/config/database.json', JSON.stringify({
    development: {
      host: 'localhost',
      port: 5432,
      database: 'webapp_dev'
    },
    production: {
      host: '${DB_HOST}',
      port: 5432,
      database: 'webapp_prod'
    }
  }, null, 2))

  // Set security metadata
  await vfs.setMetadata('/project/config/database.json', {
    sensitive: true,
    environment: 'all',
    lastReviewed: '2025-01-15',
    reviewer: 'security-team'
  })

  // Tests with relationship to source
  await vfs.writeFile('/project/tests/auth/login.test.ts', `
    import { login } from '../../src/auth/login'

    describe('Authentication', () => {
      test('valid login returns JWT', async () => {
        const token = await login('user@example.com', 'password')
        expect(token).toBeDefined()
      })
    })
  `)

  await vfs.addRelationship('/project/tests/auth/login.test.ts', '/project/src/auth/login.ts', 'tests')

  // Documentation
  await vfs.writeFile('/project/docs/API.md', `
    # API Documentation

    ## Authentication

    ### POST /api/login
    Authenticates a user and returns a JWT token.

    **Request:**
    \`\`\`json
    {
      "email": "user@example.com",
      "password": "secret"
    }
    \`\`\`
  `)

  // Find all files needing security review ✅
  const securityFiles = await vfs.search('authentication password jwt oauth', {
    path: '/project/src',
    type: 'file'
  })

  // Get project insights 📝 (see USER_FUNCTIONS.md for getProjectInsights)
  const insights = await getProjectInsights(vfs, '/project')  // User function
  console.log('Most modified files:', insights.hotspots)
  console.log('Key concepts:', insights.concepts)
  console.log('Team activity:', insights.contributors)

  // Find circular dependencies 📝 (see USER_FUNCTIONS.md)
  const circularDeps = await findCircularDependencies(vfs, '/project/src')  // User function

  // Get test coverage relationships 📝 (see USER_FUNCTIONS.md)
  const untested = await findUntestedCode(vfs, '/project/src')  // User function

  // Track technical debt ✅
  const todos = await vfs.getAllTodos('/project')
  const highPriorityDebt = todos.filter(t => t.priority === 'high' && t.status === 'pending')

  // Generate dependency graph 📝 (see USER_FUNCTIONS.md)
  const depGraph = await getDependencyGraph(vfs, '/project/src')  // User function

  // Find similar code (potential refactoring) 📝 (see USER_FUNCTIONS.md)
  const similarCode = await findSimilarCode(vfs, '/project/src/auth/login.ts', {
    threshold: 0.8,
    minLines: 10
  })  // User function

  // Export for CI/CD ✅ (Knowledge Layer provides wrapper)
  await vfs.exportToGit('/project', '/tmp/build-output')

  // Collaborative features ✅ / 🔮
  vfs.setUser('developer-alice')  // ✅ Real method
  // const conflicts = await vfs.detectConflicts('/project/src/auth/login.ts')  // 🔮 Future feature

  await vfs.close()
  await brain.close()
}
```

## Scenario 4: Multi-Project Knowledge Base

All projects in one Brainy instance, sharing concepts and cross-referencing.

```javascript
async function unifiedKnowledgeBase() {
  const brain = new Brainy({
    storage: { type: 'file', path: './knowledge-base' }
  })
  await brain.init()

  const vfs = brain.vfs()
  await vfs.init()
  await vfs.enableKnowledgeLayer()

  // Create separate project spaces
  await vfs.mkdir('/novel')
  await vfs.mkdir('/game')
  await vfs.mkdir('/webapp')

  // Shared universe - characters appear in both novel and game
  const sharedCharacter = await vfs.createEntity({
    name: 'Elena Blackwood',
    type: 'character',
    description: 'Protagonist appearing in multiple works'
  })

  // Novel chapter mentioning Elena
  await vfs.writeFile('/novel/chapter1.md', `
    Elena Blackwood stood at the edge of the digital void...
  `)

  // Game script featuring Elena as NPC
  await vfs.writeFile('/game/npcs/elena.json', JSON.stringify({
    name: 'Elena Blackwood',
    type: 'ally',
    dialogue: ['I\'ve seen this before in my world...']
  }))

  // Web app has Elena as example user
  await vfs.writeFile('/webapp/seeds/users.json', JSON.stringify([{
    name: 'Elena Blackwood',
    email: 'elena@example.com',
    role: 'detective'
  }]))

  // Cross-project entity tracking ✅
  const elenaOccurrences = await vfs.findEntityOccurrences(sharedCharacter.id)
  console.log('Elena appears across projects:', elenaOccurrences)

  // Shared technical concepts
  const authConcept = await vfs.createConcept({
    name: 'Authentication',
    type: 'technical',
    domain: 'software'
  })

  // Find auth implementations across all projects ✅
  const authImplementations = await vfs.findByConcept('Authentication')
  // Returns: /webapp/src/auth.js, /game/scripts/player-auth.js, etc.

  // Cross-project relationships ✅
  await vfs.addRelationship('/novel/chapter1.md', '/game/story/intro.txt', 'inspires')
  await vfs.addRelationship('/game/npcs/elena.json', '/novel/characters/elena.md', 'based_on')

  // Universal search across all projects ✅
  const results = await vfs.search('Elena Blackwood authentication', {
    path: '/',
    recursive: true
  })

  // Project statistics 📝 (see USER_FUNCTIONS.md for getProjectStats)
  const novelStats = await getProjectStats(vfs, '/novel')  // User function
  const gameStats = await getProjectStats(vfs, '/game')  // User function
  const webappStats = await getProjectStats(vfs, '/webapp')  // User function

  console.log('Total files:', novelStats.fileCount + gameStats.fileCount + webappStats.fileCount)
  console.log('Total size:', novelStats.totalSize + gameStats.totalSize + webappStats.totalSize)

  // Knowledge graph visualization data 🔮 (future feature)
  // const knowledgeGraph = await vfs.getGlobalKnowledgeGraph()  // Not yet implemented
  // Returns nodes (files, entities, concepts) and edges (relationships)

  // Find connections between projects 🔮 (future feature)
  // const crossProjectLinks = await vfs.findCrossProjectLinks()  // Not yet implemented

  // Unified timeline ✅
  const timeline = await vfs.getTimeline({
    from: '2025-01-01',
    to: '2025-12-31'
  })

  await vfs.close()
  await brain.close()
}
```

## Advanced Features

### Semantic Code Analysis 📝

These are user functions - see [USER_FUNCTIONS.md](./USER_FUNCTIONS.md) for implementation templates:

```javascript
// Find security vulnerabilities (user function example)
const vulnerabilities = await findPatterns(vfs, [
  'eval(',
  'innerHTML =',
  'SQL injection',
  'hardcoded password'
])

// Find code smells (user function example)
const codeSmells = await analyzeCodeQuality(vfs, '/src', {
  checkDuplication: true,
  checkComplexity: true,
  checkNaming: true
})
```

### AI-Powered Features 🔮

**Note:** These features require AI integration and are not yet available.

```javascript
// Future: Generate documentation
// const docs = await vfs.generateDocumentation('/src/auth/login.ts')

// Future: Suggest refactorings
// const refactorings = await vfs.suggestRefactorings('/src/utils.js')

// Future: Auto-complete code
// const completion = await vfs.completeCode('/src/api.ts', { line: 42, column: 10 })
```

### Migration and Backup 🔮

**Note:** These features are planned but not yet implemented.

```javascript
// Future: Backup with full history
// await vfs.createBackup('/backup/2025-01-20.brainy')

// Future: Migrate between storage backends
// const migration = await vfs.migrate({
//   from: { type: 'file', path: './old-data' },
//   to: { type: 's3', bucket: 'new-bucket' }
// })

// Future: Incremental sync
// await vfs.sync('/local/path', '/vfs/path', {
//   bidirectional: true,
//   conflictStrategy: 'newest'
// })
```

### Performance at Scale

```javascript
// Handle millions of files ✅
for (let i = 0; i < 1000000; i++) {
  await vfs.writeFile(`/data/file${i}.txt`, `Content ${i}`)
  // Uses chunking, compression, and efficient indexing
}

// Fast parallel operations ✅
await Promise.all([
  vfs.writeFile('/file1.txt', 'data1'),
  vfs.writeFile('/file2.txt', 'data2'),
  vfs.writeFile('/file3.txt', 'data3')
])

// Bulk write operations ✅
const files = [
  { path: '/data/file1.txt', content: 'Content 1' },
  { path: '/data/file2.txt', content: 'Content 2' },
  // ... more files
]
await vfs.bulkWrite(files)

// Bulk imports 🔮 (future feature)
// await vfs.bulkImport('/massive/dataset', {
//   parallel: 10,
//   batchSize: 1000,
//   progress: (count, total) => console.log(`${count}/${total}`)
// })
```

## Implementation Status

### ✅ Fully Implemented Features

All methods marked with ✅ are production-ready:

1. **Core VFS Operations**: mkdir, writeFile, readFile, appendFile, stat, readdir, etc.
2. **Entity System**: createEntity, linkEntities, findEntityOccurrences, updateEntity, getEntityGraph
3. **Concept System**: createConcept, findByConcept
4. **Knowledge Layer**: Event recording, semantic versioning, collaboration tracking
5. **Search**: Triple Intelligence (vector + field + graph)
6. **Git Integration**: importFromGit, exportToGit
7. **Export Formats**: exportToMarkdown, exportToJSON
8. **Bulk Operations**: bulkWrite for efficient batch processing
9. **Project Management**: todos, metadata, relationships

### 📝 User Functions

Methods marked with 📝 are domain-specific functions that you can implement using VFS primitives. See [USER_FUNCTIONS.md](./USER_FUNCTIONS.md) for ready-to-use templates:

- **Code Analysis**: getDependencyGraph, findCircularDependencies, findUntestedCode, findSimilarCode
- **Creative Writing**: trackCharacterArc, generateStoryBible
- **Game Development**: validateGameData, generateLootTables
- **Project Management**: getProjectInsights, generateSprintReport
- **Export Formats**: exportToEpub, exportToStaticSite

### 🔮 Future Features

Methods marked with 🔮 require AI integration or are planned for future releases:

- **AI-Powered**: generateDocumentation, suggestRefactorings, completeCode
- **Advanced Analysis**: detectConflicts, getGlobalKnowledgeGraph, findCrossProjectLinks
- **Migration Tools**: createBackup, migrate, sync, bulkImport

## Real Implementation Guarantees

- **No Mocks**: Every ✅ method is fully functional
- **Real Storage**: Uses Brainy entities with embeddings
- **Real Search**: Triple Intelligence combining vectors, fields, and graphs
- **Real Relationships**: Graph-based connections via brain.relate()
- **Production Ready**: Complete error handling, async/await, resource cleanup

The VFS + Knowledge Layer combination provides a solid foundation for intelligent applications. Use the ✅ methods directly, implement 📝 functions as needed for your domain, and stay tuned for 🔮 features.