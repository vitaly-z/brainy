# Knowledge Layer Examples 🎯

## Real-World Use Cases with Complete Code Examples

### 1. Story Writing & Character Management 📖

Perfect for authors tracking characters, plots, and themes across multiple books/chapters.

```typescript
import { Brainy, VirtualFileSystem, KnowledgeAugmentation } from '@soulcraft/brainy'

async function setupStoryManagement() {
  const brain = new Brainy()
  await brain.init()

  const vfs = new VirtualFileSystem(brain)
  await vfs.init()

  // Enable Knowledge Layer for story management
  const knowledge = new KnowledgeAugmentation({
    enabled: true,
    eventRecording: { enabled: true },
    semanticVersioning: { enabled: true, threshold: 0.4 }, // More sensitive for creative content
    persistentEntities: { enabled: true, autoExtract: false }, // Manual entity creation
    concepts: { enabled: true, autoLink: true },
    gitBridge: { enabled: true }
  })

  await knowledge.init({ brain, vfs })

  // Create main characters
  const aragornId = await vfs.createEntity({
    name: 'Aragorn',
    type: 'character',
    aliases: ['Strider', 'King Elessar', 'Telcontar'],
    attributes: {
      race: 'Human',
      role: 'King',
      status: 'alive',
      location: 'Gondor',
      relationships: ['Arwen', 'Frodo', 'Legolas'],
      characterArc: 'reluctant hero to king'
    }
  })

  const frodoId = await vfs.createEntity({
    name: 'Frodo Baggins',
    type: 'character',
    aliases: ['Frodo', 'Ring-bearer'],
    attributes: {
      race: 'Hobbit',
      role: 'Ring-bearer',
      status: 'alive',
      location: 'Shire',
      relationships: ['Sam', 'Aragorn', 'Gandalf']
    }
  })

  // Create universal themes/concepts
  const heroJourneyId = await vfs.createConcept({
    name: 'Hero\'s Journey',
    domain: 'narrative',
    category: 'pattern',
    keywords: ['hero', 'quest', 'transformation', 'journey'],
    strength: 0.9,
    metadata: { source: 'Joseph Campbell' }
  })

  const friendshipId = await vfs.createConcept({
    name: 'Friendship',
    domain: 'theme',
    category: 'emotion',
    keywords: ['loyalty', 'bond', 'trust', 'companionship'],
    strength: 0.8,
    metadata: {}
  })

  // Link concepts
  await vfs.linkConcept(heroJourneyId, friendshipId, 'related', {
    strength: 0.7,
    context: 'Friends support hero on journey'
  })

  // Write first chapter
  const chapter1 = `
# Chapter 1: An Unexpected Party

Frodo Baggins had always been the most curious of hobbits. Living in Bag End,
he often wondered what lay beyond the Shire's borders. Little did he know that
his life was about to change forever.

Aragorn, meanwhile, wandered the wild lands as Strider, ranger of the North.
His true heritage remained hidden, but destiny would soon call him home.

The friendship between unlikely companions would prove stronger than any force
of darkness. This is the beginning of the greatest hero's journey ever told.
  `

  await vfs.writeFile('/books/lotr/chapters/chapter-01.md', chapter1)

  // Record character appearances
  await vfs.recordAppearance(
    frodoId,
    '/books/lotr/chapters/chapter-01.md',
    'Frodo Baggins had always been the most curious of hobbits...',
    { confidence: 0.95, extractedBy: 'manual' }
  )

  await vfs.recordAppearance(
    aragornId,
    '/books/lotr/chapters/chapter-01.md',
    'Aragorn, meanwhile, wandered the wild lands as Strider...',
    { confidence: 0.9, extractedBy: 'manual' }
  )

  // Record concept manifestations
  await vfs.recordManifestation(
    heroJourneyId,
    '/books/lotr/chapters/chapter-01.md',
    'This is the beginning of the greatest hero\'s journey ever told.',
    'discussion',
    { confidence: 0.8 }
  )

  await vfs.recordManifestation(
    friendshipId,
    '/books/lotr/chapters/chapter-01.md',
    'The friendship between unlikely companions would prove stronger...',
    'discussion',
    { confidence: 0.9 }
  )

  // Later, when writing chapter 20...
  const chapter20 = `
# Chapter 20: The Return of the King

King Aragorn stood before the gates of Minas Tirith, no longer the ranger
Strider but the rightful ruler of Gondor. The transformation was complete -
the reluctant hero had accepted his destiny.

Frodo watched from the crowd, proud of his friend's journey. Their friendship
had been forged in fire and darkness, and now they stood in the light of victory.
  `

  await vfs.writeFile('/books/lotr/chapters/chapter-20.md', chapter20)

  // Evolve characters based on story development
  await vfs.evolveEntity(
    aragornId,
    {
      attributes: {
        ...aragornId.attributes,
        status: 'king',
        location: 'Minas Tirith',
        characterArc: 'completed - reluctant hero to accepted king'
      }
    },
    '/books/lotr/chapters/chapter-20.md',
    'Character arc completion - accepts kingship'
  )

  // Track appearances across chapters
  const aragornAppearances = await vfs.findEntityAppearances(aragornId)
  console.log(`Aragorn appears in ${aragornAppearances.length} chapters`)

  // Get character evolution over time
  const { entity, timeline } = await vfs.getEntityEvolution(aragornId)
  console.log('Aragorn\'s character development:', timeline)

  // Get concept graph for story themes
  const themeGraph = await vfs.getConceptGraph({ domain: 'theme' })
  console.log('Story themes and connections:', themeGraph)

  return { vfs, knowledge }
}
```

### 2. API Documentation Management 🔗

Perfect for maintaining living API documentation that evolves with your codebase.

```typescript
async function setupAPIDocumentation() {
  const brain = new Brainy()
  await brain.init()

  const vfs = new VirtualFileSystem(brain)
  await vfs.init()

  const knowledge = new KnowledgeAugmentation({
    enabled: true,
    semanticVersioning: { enabled: true, threshold: 0.2 }, // Sensitive to API changes
    persistentEntities: { enabled: true, autoExtract: true },
    concepts: { enabled: true, autoLink: true }
  })

  await knowledge.init({ brain, vfs })

  // Create API entities
  const usersApiId = await vfs.createEntity({
    name: 'Users API',
    type: 'api',
    aliases: ['UserService', '/api/users'],
    attributes: {
      version: '1.0',
      endpoints: [
        { method: 'GET', path: '/users', description: 'List all users' },
        { method: 'GET', path: '/users/:id', description: 'Get user by ID' },
        { method: 'POST', path: '/users', description: 'Create new user' }
      ],
      authentication: 'Bearer token',
      rateLimit: '1000/hour'
    }
  })

  const authApiId = await vfs.createEntity({
    name: 'Authentication API',
    type: 'api',
    aliases: ['AuthService', '/api/auth'],
    attributes: {
      version: '2.0',
      endpoints: [
        { method: 'POST', path: '/auth/login', description: 'User login' },
        { method: 'POST', path: '/auth/refresh', description: 'Refresh token' },
        { method: 'DELETE', path: '/auth/logout', description: 'User logout' }
      ]
    }
  })

  // Create API concepts
  const restApiId = await vfs.createConcept({
    name: 'REST API',
    domain: 'technical',
    category: 'architecture',
    keywords: ['REST', 'HTTP', 'API', 'endpoint'],
    strength: 0.9,
    metadata: {}
  })

  const authenticationId = await vfs.createConcept({
    name: 'Authentication',
    domain: 'security',
    category: 'pattern',
    keywords: ['auth', 'login', 'token', 'security'],
    strength: 0.95,
    metadata: {}
  })

  // Write initial API documentation
  const usersApiDoc = `
# Users API v1.0

The Users API provides endpoints for user management operations.

## Authentication
All endpoints require Bearer token authentication.

## Endpoints

### GET /users
Returns a list of all users in the system.

**Response:**
\`\`\`json
[
  {
    "id": "123",
    "name": "John Doe",
    "email": "john@example.com"
  }
]
\`\`\`

### GET /users/:id
Returns a specific user by ID.

### POST /users
Creates a new user in the system.
  `

  await vfs.writeFile('/docs/api/users.md', usersApiDoc)

  // Record API manifestations
  await vfs.recordAppearance(
    usersApiId,
    '/docs/api/users.md',
    'The Users API provides endpoints for user management...',
    { confidence: 1.0 }
  )

  await vfs.recordManifestation(
    restApiId,
    '/docs/api/users.md',
    'The Users API provides endpoints...',
    'implementation',
    { confidence: 0.8 }
  )

  await vfs.recordManifestation(
    authenticationId,
    '/docs/api/users.md',
    'All endpoints require Bearer token authentication.',
    'definition',
    { confidence: 0.9 }
  )

  // Later, API evolves - add new endpoint
  const updatedUsersApiDoc = usersApiDoc + `

### DELETE /users/:id
Deletes a user from the system.

**Response:**
\`\`\`json
{
  "success": true,
  "message": "User deleted successfully"
}
\`\`\`
  `

  await vfs.writeFile('/docs/api/users.md', updatedUsersApiDoc)

  // Evolve the API entity
  await vfs.evolveEntity(
    usersApiId,
    {
      attributes: {
        version: '1.1',
        endpoints: [
          { method: 'GET', path: '/users', description: 'List all users' },
          { method: 'GET', path: '/users/:id', description: 'Get user by ID' },
          { method: 'POST', path: '/users', description: 'Create new user' },
          { method: 'DELETE', path: '/users/:id', description: 'Delete user' }
        ]
      }
    },
    '/docs/api/users.md',
    'Added DELETE endpoint for user deletion'
  )

  // Track API versions across documentation
  const apiVersions = await vfs.getVersions('/docs/api/users.md')
  console.log(`API documentation has ${apiVersions.length} meaningful versions`)

  // Find all API entities
  const allApis = await vfs.findEntity({ type: 'api' })
  console.log('All APIs in system:', allApis.map(api => api.name))

  // Get concept relationships
  const apiConcepts = await vfs.findConcepts({ domain: 'technical' })
  console.log('Technical concepts:', apiConcepts)

  return { vfs, knowledge }
}
```

### 3. Research Knowledge Management 🔬

Perfect for academics and researchers tracking concepts, papers, and relationships.

```typescript
async function setupResearchManagement() {
  const brain = new Brainy()
  await brain.init()

  const vfs = new VirtualFileSystem(brain)
  await vfs.init()

  const knowledge = new KnowledgeAugmentation({
    enabled: true,
    eventRecording: { enabled: true, pruneAfterDays: 365 }, // Keep longer for research
    semanticVersioning: { enabled: true, threshold: 0.3 },
    persistentEntities: { enabled: true, autoExtract: false },
    concepts: { enabled: true, autoLink: true }
  })

  await knowledge.init({ brain, vfs })

  // Create research concepts
  const mlId = await vfs.createConcept({
    name: 'Machine Learning',
    domain: 'ai',
    category: 'field',
    keywords: ['ML', 'artificial intelligence', 'algorithms', 'data science'],
    strength: 0.95,
    metadata: { established: 1959 }
  })

  const deepLearningId = await vfs.createConcept({
    name: 'Deep Learning',
    domain: 'ai',
    category: 'technique',
    keywords: ['neural networks', 'backpropagation', 'CNN', 'RNN'],
    strength: 0.9,
    metadata: { popularized: 2012 }
  })

  const transformersId = await vfs.createConcept({
    name: 'Transformer Architecture',
    domain: 'ai',
    category: 'architecture',
    keywords: ['attention', 'self-attention', 'BERT', 'GPT'],
    strength: 0.85,
    metadata: { introduced: 2017 }
  })

  // Create concept hierarchy
  await vfs.linkConcept(mlId, deepLearningId, 'contains', {
    strength: 0.9,
    context: 'Deep Learning is a subset of Machine Learning'
  })

  await vfs.linkConcept(deepLearningId, transformersId, 'contains', {
    strength: 0.8,
    context: 'Transformers are a Deep Learning architecture'
  })

  // Create research entities (papers, authors, datasets)
  const attentionPaperId = await vfs.createEntity({
    name: 'Attention Is All You Need',
    type: 'paper',
    aliases: ['Transformer Paper', 'Vaswani et al. 2017'],
    attributes: {
      authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar'],
      year: 2017,
      venue: 'NIPS',
      citations: 50000,
      keyContributions: ['Transformer architecture', 'Self-attention mechanism']
    }
  })

  const bertPaperId = await vfs.createEntity({
    name: 'BERT: Pre-training Bidirectional Encoders',
    type: 'paper',
    aliases: ['BERT Paper', 'Devlin et al. 2018'],
    attributes: {
      authors: ['Jacob Devlin', 'Ming-Wei Chang', 'Kenton Lee'],
      year: 2018,
      venue: 'NAACL',
      citations: 30000,
      keyContributions: ['Bidirectional training', 'Masked language model']
    }
  })

  // Create research literature review
  const literatureReview = `
# Literature Review: Transformer Architectures in NLP

## Introduction

The introduction of the Transformer architecture by Vaswani et al. (2017) marked
a paradigm shift in natural language processing. This review examines key
developments in transformer-based models.

## Foundational Work

### Attention Is All You Need (Vaswani et al., 2017)

The seminal paper "Attention Is All You Need" introduced the Transformer
architecture, revolutionizing sequence-to-sequence modeling. Key innovations:

- Self-attention mechanism replacing RNNs
- Parallelizable architecture
- Superior performance on translation tasks

### BERT: Bidirectional Encoder Representations (Devlin et al., 2018)

BERT demonstrated the power of bidirectional training in language models:

- Masked language model pre-training
- Bidirectional context understanding
- State-of-the-art results on GLUE benchmark

## Analysis

The Transformer architecture represents a fundamental shift from recurrent to
attention-based models. Deep Learning continues to evolve with these innovations
building upon decades of Machine Learning research.

## Future Directions

Current research focuses on scaling transformers and improving efficiency...
  `

  await vfs.writeFile('/research/literature-review.md', literatureReview)

  // Record paper appearances in literature
  await vfs.recordAppearance(
    attentionPaperId,
    '/research/literature-review.md',
    'The seminal paper "Attention Is All You Need" introduced...',
    { confidence: 1.0 }
  )

  await vfs.recordAppearance(
    bertPaperId,
    '/research/literature-review.md',
    'BERT demonstrated the power of bidirectional training...',
    { confidence: 1.0 }
  )

  // Record concept manifestations
  await vfs.recordManifestation(
    transformersId,
    '/research/literature-review.md',
    'The Transformer architecture represents a fundamental shift...',
    'discussion',
    { confidence: 0.9 }
  )

  await vfs.recordManifestation(
    deepLearningId,
    '/research/literature-review.md',
    'Deep Learning continues to evolve with these innovations...',
    'usage',
    { confidence: 0.8 }
  )

  await vfs.recordManifestation(
    mlId,
    '/research/literature-review.md',
    'building upon decades of Machine Learning research.',
    'usage',
    { confidence: 0.7 }
  )

  // Write research notes
  const researchNotes = `
# Research Notes: Transformer Scaling

## Key Insights

- Scaling transformers shows emergent behaviors
- Attention patterns become more sophisticated with size
- Computational requirements grow quadratically

## Open Questions

1. How to make attention more efficient?
2. Can we understand what large models learn?
3. What are the limits of scaling?

## Related Work

See "Attention Is All You Need" for foundational concepts.
BERT shows bidirectional training benefits.
  `

  await vfs.writeFile('/research/notes/transformer-scaling.md', researchNotes)

  // Later, add new insights
  const updatedNotes = researchNotes + `

## New Findings (Added: ${new Date().toISOString()})

Recent work on sparse attention patterns shows promise for efficiency:
- Linear attention mechanisms
- Sliding window attention
- Random attention patterns

These could address the quadratic scaling problem.
  `

  await vfs.writeFile('/research/notes/transformer-scaling.md', updatedNotes)

  // Get concept evolution and relationships
  const conceptGraph = await vfs.getConceptGraph({ domain: 'ai' })
  console.log('AI concept network:', conceptGraph)

  // Find all manifestations of a concept
  const transformerManifestations = await vfs.findConceptAppearances(transformersId)
  console.log(`Transformer concept appears in ${transformerManifestations.length} documents`)

  // Track paper citations and influence
  const paperHistory = await vfs.getEntityEvolution(attentionPaperId)
  console.log('Paper evolution:', paperHistory)

  // Export research for collaboration
  await vfs.exportToGit(
    '/research',
    '/tmp/research-export',
    {
      preserveMetadata: true,
      preserveRelationships: true,
      commitMessage: 'Export research database'
    }
  )

  return { vfs, knowledge }
}
```

### 4. Software Architecture Documentation 🏗️

Perfect for maintaining living architecture documentation that evolves with your system.

```typescript
async function setupArchitectureDocumentation() {
  const brain = new Brainy()
  await brain.init()

  const vfs = new VirtualFileSystem(brain)
  await vfs.init()

  const knowledge = new KnowledgeAugmentation({
    enabled: true,
    persistentEntities: { enabled: true, autoExtract: true }, // Auto-extract services/components
    concepts: { enabled: true, autoLink: true },
    semanticVersioning: { enabled: true, threshold: 0.25 } // Sensitive to architecture changes
  })

  await knowledge.init({ brain, vfs })

  // Create architectural concepts
  const microservicesId = await vfs.createConcept({
    name: 'Microservices Architecture',
    domain: 'architecture',
    category: 'pattern',
    keywords: ['microservices', 'distributed', 'services', 'SOA'],
    strength: 0.9,
    metadata: {}
  })

  const eventDrivenId = await vfs.createConcept({
    name: 'Event-Driven Architecture',
    domain: 'architecture',
    category: 'pattern',
    keywords: ['events', 'pub-sub', 'async', 'messaging'],
    strength: 0.85,
    metadata: {}
  })

  const cqrsId = await vfs.createConcept({
    name: 'CQRS',
    domain: 'architecture',
    category: 'pattern',
    keywords: ['command query', 'separation', 'read write'],
    strength: 0.8,
    metadata: {}
  })

  // Link architectural patterns
  await vfs.linkConcept(microservicesId, eventDrivenId, 'often-uses', {
    strength: 0.8,
    context: 'Microservices often use event-driven communication'
  })

  await vfs.linkConcept(eventDrivenId, cqrsId, 'enables', {
    strength: 0.7,
    context: 'Event-driven architecture enables CQRS pattern'
  })

  // Create service entities
  const userServiceId = await vfs.createEntity({
    name: 'User Service',
    type: 'service',
    aliases: ['UserService', 'users-service'],
    attributes: {
      port: 3001,
      database: 'users-db',
      endpoints: ['/users', '/users/:id', '/users/auth'],
      dependencies: ['Auth Service', 'Notification Service'],
      responsibilities: ['User management', 'Profile operations']
    }
  })

  const orderServiceId = await vfs.createEntity({
    name: 'Order Service',
    type: 'service',
    aliases: ['OrderService', 'orders-service'],
    attributes: {
      port: 3002,
      database: 'orders-db',
      endpoints: ['/orders', '/orders/:id', '/orders/status'],
      dependencies: ['User Service', 'Payment Service'],
      responsibilities: ['Order processing', 'Order tracking']
    }
  })

  const apiGatewayId = await vfs.createEntity({
    name: 'API Gateway',
    type: 'component',
    aliases: ['Gateway', 'api-gateway'],
    attributes: {
      port: 3000,
      type: 'ingress',
      routes: {
        '/api/users/*': 'User Service',
        '/api/orders/*': 'Order Service'
      },
      responsibilities: ['Request routing', 'Authentication', 'Rate limiting']
    }
  })

  // Write architecture documentation
  const architectureDoc = `
# System Architecture Overview

Our e-commerce platform follows a **Microservices Architecture** pattern with
**Event-Driven Architecture** for inter-service communication.

## Core Services

### API Gateway
- Entry point for all client requests
- Handles authentication and request routing
- Routes requests to appropriate services

### User Service
- Manages user accounts and profiles
- Handles user authentication
- Publishes user events for other services

### Order Service
- Processes customer orders
- Manages order lifecycle
- Integrates with Payment Service for transactions

## Architecture Patterns

### Microservices
Each service is independently deployable and scalable. Services communicate
through well-defined APIs and events.

### Event-Driven Communication
Services publish events when state changes occur. This enables loose coupling
and eventual consistency across the system.

### CQRS Pattern
We separate read and write operations to optimize for different access patterns.
Commands modify state while queries read optimized views.

## Service Dependencies

- API Gateway → User Service, Order Service
- Order Service → User Service, Payment Service
- User Service → Notification Service

## Event Flow

1. User creates account → User Service publishes UserCreated event
2. Order placed → Order Service publishes OrderCreated event
3. Payment processed → Payment Service publishes PaymentCompleted event
  `

  await vfs.writeFile('/docs/architecture/overview.md', architectureDoc)

  // Record service appearances
  await vfs.recordAppearance(
    userServiceId,
    '/docs/architecture/overview.md',
    'User Service manages user accounts and profiles...',
    { confidence: 1.0 }
  )

  await vfs.recordAppearance(
    orderServiceId,
    '/docs/architecture/overview.md',
    'Order Service processes customer orders...',
    { confidence: 1.0 }
  )

  await vfs.recordAppearance(
    apiGatewayId,
    '/docs/architecture/overview.md',
    'API Gateway is the entry point for all client requests...',
    { confidence: 1.0 }
  )

  // Record concept manifestations
  await vfs.recordManifestation(
    microservicesId,
    '/docs/architecture/overview.md',
    'Our e-commerce platform follows a Microservices Architecture...',
    'implementation',
    { confidence: 0.95 }
  )

  await vfs.recordManifestation(
    eventDrivenId,
    '/docs/architecture/overview.md',
    'Event-Driven Architecture for inter-service communication...',
    'implementation',
    { confidence: 0.9 }
  )

  await vfs.recordManifestation(
    cqrsId,
    '/docs/architecture/overview.md',
    'We separate read and write operations using CQRS Pattern...',
    'implementation',
    { confidence: 0.85 }
  )

  // Later, system evolves - add new service
  await vfs.evolveEntity(
    orderServiceId,
    {
      attributes: {
        port: 3002,
        database: 'orders-db',
        endpoints: ['/orders', '/orders/:id', '/orders/status', '/orders/analytics'],
        dependencies: ['User Service', 'Payment Service', 'Analytics Service'],
        responsibilities: ['Order processing', 'Order tracking', 'Order analytics']
      }
    },
    '/docs/architecture/service-updates.md',
    'Added analytics capability and Analytics Service dependency'
  )

  // Write deployment documentation
  const deploymentDoc = `
# Deployment Architecture

## Container Strategy
Each service runs in its own Docker container with the following configuration:

### User Service
- Image: user-service:v1.2.0
- Port: 3001
- Environment: DATABASE_URL, JWT_SECRET
- Health Check: GET /health

### Order Service
- Image: order-service:v1.1.0
- Port: 3002
- Environment: DATABASE_URL, PAYMENT_API_KEY
- Health Check: GET /health

### API Gateway
- Image: api-gateway:v2.0.0
- Port: 3000
- Environment: USER_SERVICE_URL, ORDER_SERVICE_URL
- Health Check: GET /health

## Service Mesh
We use Istio for service mesh functionality:
- Traffic management and routing
- Security policies between services
- Observability and monitoring
  `

  await vfs.writeFile('/docs/architecture/deployment.md', deploymentDoc)

  // Get architecture evolution
  const serviceVersions = await vfs.getVersions('/docs/architecture/overview.md')
  console.log(`Architecture documented through ${serviceVersions.length} major revisions`)

  // Find all services in the system
  const services = await vfs.findEntity({ type: 'service' })
  console.log('System services:', services.map(s => s.name))

  // Get architectural concept relationships
  const archGraph = await vfs.getConceptGraph({ domain: 'architecture' })
  console.log('Architecture pattern relationships:', archGraph)

  // Export architecture for team review
  await vfs.exportToGit(
    '/docs/architecture',
    '/tmp/architecture-docs',
    {
      preserveMetadata: true,
      preserveRelationships: true,
      commitMessage: 'Architecture documentation export'
    }
  )

  return { vfs, knowledge }
}
```

### 5. Business Process Documentation 📊

Perfect for documenting and tracking business processes, workflows, and organizational knowledge.

```typescript
async function setupBusinessProcessManagement() {
  const brain = new Brainy()
  await brain.init()

  const vfs = new VirtualFileSystem(brain)
  await vfs.init()

  const knowledge = new KnowledgeAugmentation({
    enabled: true,
    eventRecording: { enabled: true },
    semanticVersioning: { enabled: true, threshold: 0.3 },
    persistentEntities: { enabled: true, autoExtract: false },
    concepts: { enabled: true, autoLink: true }
  })

  await knowledge.init({ brain, vfs })

  // Create business concepts
  const customerJourneyId = await vfs.createConcept({
    name: 'Customer Journey',
    domain: 'business',
    category: 'process',
    keywords: ['customer', 'journey', 'experience', 'touchpoints'],
    strength: 0.9,
    metadata: {}
  })

  const salesFunnelId = await vfs.createConcept({
    name: 'Sales Funnel',
    domain: 'business',
    category: 'process',
    keywords: ['sales', 'funnel', 'conversion', 'pipeline'],
    strength: 0.85,
    metadata: {}
  })

  const crmId = await vfs.createConcept({
    name: 'Customer Relationship Management',
    domain: 'business',
    category: 'system',
    keywords: ['CRM', 'customer', 'relationship', 'management'],
    strength: 0.8,
    metadata: {}
  })

  // Link business concepts
  await vfs.linkConcept(customerJourneyId, salesFunnelId, 'includes', {
    strength: 0.8,
    context: 'Customer journey includes the sales funnel process'
  })

  await vfs.linkConcept(salesFunnelId, crmId, 'managed-by', {
    strength: 0.7,
    context: 'Sales funnel is managed through CRM system'
  })

  // Create business entities (roles, processes, systems)
  const salesRepId = await vfs.createEntity({
    name: 'Sales Representative',
    type: 'role',
    aliases: ['Sales Rep', 'Account Executive'],
    attributes: {
      department: 'Sales',
      responsibilities: ['Lead qualification', 'Demo presentations', 'Deal closure'],
      tools: ['Salesforce', 'HubSpot', 'Zoom'],
      kpis: ['Revenue', 'Conversion rate', 'Deal size']
    }
  })

  const marketingManagerId = await vfs.createEntity({
    name: 'Marketing Manager',
    type: 'role',
    aliases: ['Marketing Lead', 'Growth Manager'],
    attributes: {
      department: 'Marketing',
      responsibilities: ['Campaign management', 'Lead generation', 'Brand awareness'],
      tools: ['Google Ads', 'Mailchimp', 'Analytics'],
      kpis: ['Lead volume', 'Cost per lead', 'Brand metrics']
    }
  })

  const onboardingProcessId = await vfs.createEntity({
    name: 'Customer Onboarding Process',
    type: 'process',
    aliases: ['Onboarding', 'Customer Setup'],
    attributes: {
      duration: '2-4 weeks',
      stages: ['Welcome', 'Setup', 'Training', 'Go-live'],
      owner: 'Customer Success',
      touchpoints: ['Email', 'Video calls', 'In-app guidance']
    }
  })

  // Write business process documentation
  const salesProcessDoc = `
# Sales Process Documentation

## Overview

Our sales process is designed around the customer journey, guiding prospects
from initial awareness through to successful onboarding.

## Sales Funnel Stages

### 1. Lead Generation
- **Owner:** Marketing Manager
- **Activities:** Content marketing, paid advertising, event marketing
- **Goal:** Generate qualified leads for sales team
- **Tools:** Google Ads, LinkedIn, Content marketing

### 2. Lead Qualification
- **Owner:** Sales Representative
- **Activities:** Initial outreach, qualification calls, need assessment
- **Goal:** Identify high-potential prospects
- **Criteria:** Budget, Authority, Need, Timeline (BANT)

### 3. Demo & Presentation
- **Owner:** Sales Representative
- **Activities:** Product demonstrations, use case discussions
- **Goal:** Showcase value proposition and fit
- **Duration:** 30-60 minutes

### 4. Proposal & Negotiation
- **Owner:** Sales Representative
- **Activities:** Custom proposals, pricing discussions, contract terms
- **Goal:** Reach mutually beneficial agreement
- **Stakeholders:** Legal, Finance, Customer Procurement

### 5. Deal Closure
- **Owner:** Sales Representative
- **Activities:** Contract signing, payment terms, implementation planning
- **Goal:** Signed contract and smooth handoff
- **Handoff:** Customer Success team for onboarding

## Customer Relationship Management

All customer interactions are tracked in our CRM system (Salesforce):
- Contact information and communication history
- Deal stage and probability tracking
- Task and follow-up management
- Sales forecasting and reporting

## Key Performance Indicators

- **Sales Representative KPIs:**
  - Monthly recurring revenue (MRR)
  - Conversion rate by stage
  - Average deal size
  - Sales cycle length

- **Marketing Manager KPIs:**
  - Lead volume and quality
  - Cost per lead (CPL)
  - Marketing qualified leads (MQL)
  - Return on marketing investment (ROMI)

## Customer Onboarding Process

Once a deal is closed, customers enter our structured onboarding process
managed by the Customer Success team...
  `

  await vfs.writeFile('/processes/sales-process.md', salesProcessDoc)

  // Record entity appearances in process documentation
  await vfs.recordAppearance(
    salesRepId,
    '/processes/sales-process.md',
    'Sales Representative owns lead qualification, demo presentations...',
    { confidence: 1.0 }
  )

  await vfs.recordAppearance(
    marketingManagerId,
    '/processes/sales-process.md',
    'Marketing Manager generates qualified leads through content marketing...',
    { confidence: 1.0 }
  )

  await vfs.recordAppearance(
    onboardingProcessId,
    '/processes/sales-process.md',
    'customers enter our structured onboarding process...',
    { confidence: 0.8 }
  )

  // Record business concept manifestations
  await vfs.recordManifestation(
    customerJourneyId,
    '/processes/sales-process.md',
    'Our sales process is designed around the customer journey...',
    'implementation',
    { confidence: 0.9 }
  )

  await vfs.recordManifestation(
    salesFunnelId,
    '/processes/sales-process.md',
    'Sales Funnel Stages from lead generation through deal closure...',
    'definition',
    { confidence: 0.95 }
  )

  await vfs.recordManifestation(
    crmId,
    '/processes/sales-process.md',
    'All customer interactions are tracked in our CRM system...',
    'usage',
    { confidence: 0.85 }
  )

  // Write role-specific documentation
  const salesPlaybook = `
# Sales Representative Playbook

## Daily Activities

### Morning (9:00 - 11:00 AM)
- Review overnight leads and prioritize outreach
- Follow up on pending proposals and negotiations
- Update CRM with previous day's activities

### Midday (11:00 AM - 3:00 PM)
- Conduct qualification calls with new leads
- Deliver product demos to qualified prospects
- Prepare custom proposals for advanced opportunities

### Afternoon (3:00 - 6:00 PM)
- Internal stakeholder coordination (legal, finance)
- Deal review and forecasting updates
- Team collaboration and knowledge sharing

## Qualification Framework (BANT)

- **Budget:** Does prospect have allocated budget?
- **Authority:** Are we speaking with decision maker?
- **Need:** Is there clear business need for our solution?
- **Timeline:** When do they plan to implement?

## Demo Best Practices

1. Customize demo to prospect's specific use case
2. Focus on business outcomes, not just features
3. Include relevant customer success stories
4. Address objections proactively
5. Define clear next steps

## Common Objections and Responses

**"Your solution is too expensive"**
- Focus on ROI and cost of inaction
- Break down pricing to show value per user/month
- Reference similar customer success cases

**"We need to evaluate other options"**
- Understand evaluation criteria and timeline
- Offer to facilitate competitive analysis
- Provide references for head-to-head comparisons
  `

  await vfs.writeFile('/processes/sales-playbook.md', salesPlaybook)

  // Later, process evolves - add new stage
  const updatedSalesProcess = salesProcessDoc + `

### 6. Post-Sale Success Tracking (NEW)
- **Owner:** Customer Success Manager
- **Activities:** Usage monitoring, health scoring, expansion opportunities
- **Goal:** Ensure customer success and identify growth opportunities
- **Timeline:** Ongoing throughout customer lifecycle
  `

  await vfs.writeFile('/processes/sales-process.md', updatedSalesProcess)

  // Evolve the sales process entity
  await vfs.evolveEntity(
    salesRepId,
    {
      attributes: {
        department: 'Sales',
        responsibilities: [
          'Lead qualification',
          'Demo presentations',
          'Deal closure',
          'Post-sale success tracking' // NEW
        ],
        tools: ['Salesforce', 'HubSpot', 'Zoom', 'Customer Success Platform'],
        kpis: ['Revenue', 'Conversion rate', 'Deal size', 'Customer health score']
      }
    },
    '/processes/sales-process.md',
    'Added post-sale success tracking responsibilities'
  )

  // Import existing business documentation
  await vfs.importFromGit(
    '/existing/business-docs',
    '/imported/business-knowledge',
    {
      extractMetadata: true,
      preserveGitHistory: true
    }
  )

  // Get business process evolution
  const processHistory = await vfs.getEntityEvolution(salesRepId)
  console.log('Sales role evolution:', processHistory.timeline)

  // Find all business roles
  const roles = await vfs.findEntity({ type: 'role' })
  console.log('Business roles:', roles.map(r => r.name))

  // Get business concept network
  const businessGraph = await vfs.getConceptGraph({ domain: 'business' })
  console.log('Business concept relationships:', businessGraph)

  return { vfs, knowledge }
}
```

## Integration Example: Complete Knowledge Ecosystem

Here's how to set up a complete knowledge ecosystem that combines multiple use cases:

```typescript
async function setupCompleteKnowledgeEcosystem() {
  const brain = new Brainy()
  await brain.init()

  const vfs = new VirtualFileSystem(brain)
  await vfs.init()

  // Maximum knowledge layer configuration
  const knowledge = new KnowledgeAugmentation({
    enabled: true,
    eventRecording: {
      enabled: true,
      pruneAfterDays: 180,
      compressEvents: true
    },
    semanticVersioning: {
      enabled: true,
      threshold: 0.25,
      maxVersions: 15
    },
    persistentEntities: {
      enabled: true,
      autoExtract: true
    },
    concepts: {
      enabled: true,
      autoLink: true
    },
    gitBridge: {
      enabled: true
    }
  })

  await knowledge.init({ brain, vfs })

  console.log('🧠 Complete Knowledge Ecosystem Initialized!')
  console.log('📁 Files become intelligent entities')
  console.log('🔄 Every change is semantically versioned')
  console.log('👤 Entities evolve across files and time')
  console.log('💡 Concepts link across all domains')
  console.log('📚 Complete history with time travel')
  console.log('🌉 Git import/export for collaboration')

  // Your files are now living, breathing knowledge!
  return { brain, vfs, knowledge }
}
```

---

These examples show how the Knowledge Layer transforms different domains:

- **📖 Creative Writing** - Characters evolve, themes connect, stories have memory
- **🔗 API Documentation** - Living docs that version meaningfully and track evolution
- **🔬 Research** - Concepts transcend papers, relationships form knowledge graphs
- **🏗️ Architecture** - Services and patterns tracked across all documentation
- **📊 Business Process** - Roles evolve, processes adapt, knowledge persists

The Knowledge Layer makes your filesystem **intelligent**. Welcome to the future! 🚀