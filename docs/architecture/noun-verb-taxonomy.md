# Noun-Verb Taxonomy Architecture

## Overview

Brainy 2.0 introduces a revolutionary **Noun-Verb Taxonomy** that models data as entities (nouns) and relationships (verbs), creating a semantic knowledge graph that mirrors how humans naturally think about information.

## Why Noun-Verb?

Traditional databases force you to think in tables, documents, or nodes. Brainy lets you think naturally:

- **Nouns**: Things that exist (people, documents, products, concepts)
- **Verbs**: How things relate (creates, owns, references, similar-to)

This simple mental model scales from basic storage to complex knowledge graphs while remaining intuitive.

## Core Concepts

### Nouns (Entities)

Nouns represent any entity in your system:

```typescript
// Add any entity as a noun
const personId = await brain.addNoun("John Smith, Senior Engineer", {
  type: "person",
  department: "engineering",
  skills: ["TypeScript", "React", "Node.js"]
})

const documentId = await brain.addNoun("Q3 2024 Financial Report", {
  type: "document",
  category: "financial",
  confidential: true,
  created: "2024-10-01"
})

const conceptId = await brain.addNoun("Machine Learning", {
  type: "concept",
  domain: "technology",
  complexity: "advanced"
})
```

#### Noun Properties

Every noun automatically gets:
- **Unique ID**: System-generated or custom
- **Vector Embedding**: For semantic similarity
- **Metadata**: Flexible JSON properties
- **Timestamps**: Created/updated tracking
- **Indexing**: Automatic field indexing

### Verbs (Relationships)

Verbs define how nouns relate to each other:

```typescript
// Create relationships between entities
await brain.addVerb(personId, documentId, "authored", {
  role: "primary_author",
  contribution: "80%"
})

await brain.addVerb(documentId, conceptId, "discusses", {
  sections: ["methodology", "results"],
  depth: "detailed"
})

await brain.addVerb(personId, conceptId, "expert_in", {
  years_experience: 5,
  certification: "Advanced ML Certification"
})
```

#### Verb Properties

Every verb includes:
- **Source**: The noun initiating the relationship
- **Target**: The noun receiving the relationship
- **Type**: The relationship type/name
- **Direction**: Directional or bidirectional
- **Metadata**: Relationship-specific data
- **Strength**: Optional relationship weight

## Benefits

### 1. Natural Mental Model

```typescript
// Think naturally about your data
const taskId = await brain.addNoun("Implement payment system")
const userId = await brain.addNoun("Alice Johnson")
const projectId = await brain.addNoun("E-commerce Platform")

// Express relationships clearly
await brain.addVerb(userId, taskId, "assigned_to")
await brain.addVerb(taskId, projectId, "part_of")
await brain.addVerb(userId, projectId, "manages")
```

### 2. Semantic Understanding

The noun-verb model preserves meaning:

```typescript
// The system understands semantic relationships
const results = await brain.find("tasks assigned to Alice")
// Automatically understands: assigned_to verb + Alice noun

const related = await brain.find("people who manage projects with payment tasks")
// Traverses: person -> manages -> project -> contains -> task
```

### 3. Flexible Schema

No rigid schema requirements:

```typescript
// Add any noun type without schema changes
await brain.addNoun("New IoT Sensor", { 
  type: "device",
  protocol: "MQTT",
  location: "Building A"
})

// Create new relationship types on the fly
await brain.addVerb(sensorId, buildingId, "monitors", {
  metrics: ["temperature", "humidity"],
  interval: "5 minutes"
})
```

### 4. Graph Traversal

Navigate relationships naturally:

```typescript
// Find all documents authored by team members
const teamDocs = await brain.find({
  connected: {
    from: teamId,
    through: ["member_of", "authored"],
    depth: 2
  }
})

// Find similar products purchased by similar users
const recommendations = await brain.find({
  connected: {
    from: userId,
    through: ["similar_to", "purchased"],
    depth: 2,
    type: "product"
  }
})
```

### 5. Temporal Relationships

Track how relationships change over time:

```typescript
// Relationships with temporal data
await brain.addVerb(employeeId, companyId, "worked_at", {
  from: "2020-01-01",
  to: "2023-12-31",
  position: "Senior Developer"
})

await brain.addVerb(employeeId, newCompanyId, "works_at", {
  from: "2024-01-01",
  position: "Tech Lead"
})

// Query historical relationships
const employment = await brain.find("where did John work in 2022")
```

## Real-World Use Cases

### Knowledge Management

```typescript
// Documents and their relationships
const paperId = await brain.addNoun("Neural Networks Paper", {
  type: "research_paper",
  year: 2024
})

const authorId = await brain.addNoun("Dr. Sarah Chen", {
  type: "researcher"
})

const topicId = await brain.addNoun("Deep Learning", {
  type: "topic"
})

// Rich relationship network
await brain.addVerb(authorId, paperId, "authored")
await brain.addVerb(paperId, topicId, "covers")
await brain.addVerb(paperId, otherPaperId, "cites")
await brain.addVerb(authorId, topicId, "researches")

// Query the knowledge graph
const related = await brain.find("papers about deep learning by Sarah Chen")
```

### Social Networks

```typescript
// Users and connections
const user1 = await brain.addNoun("Alice", { type: "user" })
const user2 = await brain.addNoun("Bob", { type: "user" })
const post = await brain.addNoun("Great article on AI!", { type: "post" })

// Social interactions
await brain.addVerb(user1, user2, "follows")
await brain.addVerb(user2, user1, "follows") // Mutual
await brain.addVerb(user1, post, "created")
await brain.addVerb(user2, post, "liked")
await brain.addVerb(user2, post, "shared")

// Find social patterns
const influencers = await brain.find("users with most followers who post about AI")
```

### E-commerce

```typescript
// Products and purchases
const product = await brain.addNoun("Wireless Headphones", {
  type: "product",
  price: 99.99,
  category: "electronics"
})

const customer = await brain.addNoun("Customer #12345", {
  type: "customer",
  tier: "premium"
})

// Purchase relationships
await brain.addVerb(customer, product, "purchased", {
  date: "2024-01-15",
  quantity: 1,
  price: 99.99
})

await brain.addVerb(customer, product, "reviewed", {
  rating: 5,
  text: "Excellent sound quality!"
})

// Recommendation queries
const recs = await brain.find("products purchased by customers who bought headphones")
```

### Project Management

```typescript
// Projects, tasks, and teams
const project = await brain.addNoun("Website Redesign", { type: "project" })
const task = await brain.addNoun("Update homepage", { type: "task" })
const developer = await brain.addNoun("Jane Developer", { type: "person" })
const designer = await brain.addNoun("John Designer", { type: "person" })

// Work relationships
await brain.addVerb(task, project, "belongs_to")
await brain.addVerb(developer, task, "assigned_to")
await brain.addVerb(designer, developer, "collaborates_with")
await brain.addVerb(task, otherTask, "depends_on")

// Project queries
const blockers = await brain.find("tasks that depend on incomplete tasks")
const workload = await brain.find("people assigned to multiple active projects")
```

## Advanced Patterns

### Bidirectional Relationships

```typescript
// Some relationships are naturally bidirectional
await brain.addVerb(user1, user2, "friend_of", { bidirectional: true })
// Automatically creates inverse relationship
```

### Weighted Relationships

```typescript
// Add strength/weight to relationships
await brain.addVerb(doc1, doc2, "similar_to", {
  similarity_score: 0.95,
  algorithm: "cosine"
})

// Use weights in queries
const stronglyRelated = await brain.find({
  connected: {
    type: "similar_to",
    minWeight: 0.8
  }
})
```

### Relationship Chains

```typescript
// Follow relationship chains
const results = await brain.find({
  connected: {
    from: userId,
    chain: [
      { type: "owns", to: "company" },
      { type: "produces", to: "product" },
      { type: "uses", to: "technology" }
    ]
  }
})
// Finds: technologies used by products made by companies owned by user
```

### Meta-Relationships

```typescript
// Relationships about relationships
const verbId = await brain.addVerb(user1, user2, "recommends")
await brain.addVerb(user3, verbId, "endorses", {
  reason: "Accurate recommendation",
  trust_score: 0.9
})
```

## Query Patterns

### Finding Nouns

```typescript
// By type
const people = await brain.find({ where: { type: "person" } })

// By properties
const documents = await brain.find({
  where: {
    type: "document",
    confidential: false,
    created: { $gte: "2024-01-01" }
  }
})

// By similarity
const similar = await brain.find({
  like: "machine learning research",
  where: { type: "document" }
})
```

### Finding Verbs

```typescript
// Get all relationships for a noun
const relationships = await brain.getVerbs(nounId)

// Find specific relationship types
const authorships = await brain.find({
  verb: {
    type: "authored",
    from: authorId
  }
})

// Find by relationship properties
const recentPurchases = await brain.find({
  verb: {
    type: "purchased",
    where: {
      date: { $gte: "2024-01-01" }
    }
  }
})
```

### Combined Queries

```typescript
// Find nouns through relationships
const results = await brain.find({
  // Start with similar documents
  like: "AI research",
  // That are authored by
  connected: {
    through: "authored",
    // People who work at
    where: {
      connected: {
        to: "Stanford",
        type: "works_at"
      }
    }
  }
})
```

## Performance Optimizations

### Noun Indexing
- Automatic vector indexing for similarity
- Field indexing for metadata queries
- Full-text indexing for content search

### Verb Indexing
- Relationship type indexing
- Source/target indexing
- Temporal indexing for time-based queries

### Query Optimization
- Automatic query plan optimization
- Parallel execution of independent operations
- Result caching for repeated queries

## Best Practices

1. **Use Descriptive Types**: Make noun and verb types self-documenting
2. **Rich Metadata**: Include relevant metadata for better querying
3. **Consistent Naming**: Use consistent verb names across your application
4. **Temporal Data**: Include timestamps for time-based analysis
5. **Bidirectional When Appropriate**: Mark symmetric relationships as bidirectional

## Migration from Traditional Models

### From Relational (SQL)
```typescript
// Instead of JOIN queries
// SELECT * FROM users JOIN orders ON users.id = orders.user_id

// Use noun-verb relationships
const userId = await brain.addNoun("User", userData)
const orderId = await brain.addNoun("Order", orderData)
await brain.addVerb(userId, orderId, "placed")

// Query naturally
const userOrders = await brain.find({
  connected: { from: userId, type: "placed" }
})
```

### From Document (NoSQL)
```typescript
// Instead of embedded documents
// { user: { orders: [...] } }

// Use explicit relationships
const userId = await brain.addNoun("User", userData)
for (const order of orders) {
  const orderId = await brain.addNoun("Order", order)
  await brain.addVerb(userId, orderId, "has_order")
}
```

### From Graph Databases
```typescript
// Similar to graph databases but with added benefits:
// 1. Automatic vector embeddings for similarity
// 2. Natural language querying
// 3. Unified with field filtering

// Enhanced graph queries
const results = await brain.find("similar users who purchased similar products")
```

## Universal Knowledge Coverage

The Noun-Verb taxonomy is designed to represent **all human knowledge** through a finite set of fundamental types that can be combined infinitely.

### Core Noun Types

#### 1. **Person** - Individual entities
```typescript
await brain.addNoun("Albert Einstein", {
  type: "person",
  role: "physicist",
  born: "1879-03-14",
  nationality: "German-American"
})
```
Covers: Individuals, users, authors, employees, customers, contacts

#### 2. **Organization** - Collective entities
```typescript
await brain.addNoun("OpenAI", {
  type: "organization",
  industry: "AI research",
  founded: 2015,
  size: "500-1000"
})
```
Covers: Companies, institutions, teams, governments, communities

#### 3. **Place** - Spatial entities
```typescript
await brain.addNoun("San Francisco", {
  type: "place",
  category: "city",
  coordinates: [37.7749, -122.4194],
  population: 873965
})
```
Covers: Locations, addresses, regions, venues, virtual spaces

#### 4. **Thing** - Physical objects
```typescript
await brain.addNoun("Tesla Model 3", {
  type: "thing",
  category: "vehicle",
  manufacturer: "Tesla",
  year: 2024
})
```
Covers: Products, devices, equipment, artifacts, physical items

#### 5. **Concept** - Abstract ideas
```typescript
await brain.addNoun("Machine Learning", {
  type: "concept",
  domain: "technology",
  complexity: "advanced",
  related: ["AI", "statistics"]
})
```
Covers: Ideas, theories, principles, methodologies, philosophies

#### 6. **Document** - Information containers
```typescript
await brain.addNoun("Quarterly Report Q3 2024", {
  type: "document",
  format: "PDF",
  confidential: true,
  pages: 47
})
```
Covers: Files, articles, reports, media, records, content

#### 7. **Event** - Temporal occurrences
```typescript
await brain.addNoun("Product Launch 2024", {
  type: "event",
  date: "2024-09-15",
  attendees: 500,
  virtual: false
})
```
Covers: Meetings, incidents, milestones, activities, happenings

#### 8. **Process** - Sequences of actions
```typescript
await brain.addNoun("Customer Onboarding", {
  type: "process",
  steps: 5,
  duration: "3 days",
  automated: true
})
```
Covers: Workflows, procedures, algorithms, lifecycles, methods

#### 9. **Metric** - Measurable values
```typescript
await brain.addNoun("Revenue Growth Rate", {
  type: "metric",
  value: 0.23,
  unit: "percentage",
  period: "quarterly"
})
```
Covers: KPIs, measurements, statistics, scores, quantities

#### 10. **State** - Conditions or status
```typescript
await brain.addNoun("System Operational", {
  type: "state",
  category: "health",
  severity: "normal",
  since: Date.now()
})
```
Covers: Status, conditions, phases, modes, configurations

### Core Verb Types

#### 1. **Creates** - Genesis relationships
```typescript
await brain.addVerb(authorId, documentId, "creates")
```
Variations: authors, produces, generates, builds, develops

#### 2. **Owns** - Possession relationships
```typescript
await brain.addVerb(userId, assetId, "owns")
```
Variations: has, possesses, controls, manages, maintains

#### 3. **Contains** - Compositional relationships
```typescript
await brain.addVerb(folderId, fileId, "contains")
```
Variations: includes, comprises, consists-of, has-part

#### 4. **Relates** - Association relationships
```typescript
await brain.addVerb(concept1Id, concept2Id, "relates")
```
Variations: connects, associates, links, corresponds

#### 5. **Transforms** - Change relationships
```typescript
await brain.addVerb(processId, inputId, "transforms", { 
  to: outputId 
})
```
Variations: converts, processes, modifies, evolves

#### 6. **Interacts** - Action relationships
```typescript
await brain.addVerb(userId, systemId, "interacts")
```
Variations: uses, accesses, engages, communicates

#### 7. **Depends** - Dependency relationships
```typescript
await brain.addVerb(moduleAId, moduleBId, "depends")
```
Variations: requires, needs, relies-on, prerequisites

#### 8. **Flows** - Movement relationships
```typescript
await brain.addVerb(sourceId, destinationId, "flows")
```
Variations: moves, transfers, migrates, sends

#### 9. **Evaluates** - Assessment relationships
```typescript
await brain.addVerb(reviewerId, proposalId, "evaluates")
```
Variations: reviews, rates, measures, analyzes

#### 10. **Temporal** - Time-based relationships
```typescript
await brain.addVerb(event1Id, event2Id, "precedes")
```
Variations: follows, during, overlaps, schedules

### Why This Covers All Knowledge

#### 1. **Mathematical Completeness**
The noun-verb model forms a **complete graph structure** where:
- Any entity can be represented as a noun
- Any relationship can be represented as a verb
- Complex knowledge emerges from simple combinations

#### 2. **Semantic Completeness**
Every piece of human knowledge falls into one of these categories:
- **Entities** (who, what, where) → Nouns
- **Actions** (how, when, why) → Verbs
- **Attributes** (properties) → Metadata
- **Context** (conditions) → Graph structure

#### 3. **Compositional Power**
Simple types combine to represent complex knowledge:
```typescript
// Complex knowledge from simple building blocks
const researchPaper = await brain.addNoun("AI Ethics Study", {
  type: "document"
})

const researcher = await brain.addNoun("Dr. Smith", {
  type: "person"
})

const institution = await brain.addNoun("MIT", {
  type: "organization"
})

const concept = await brain.addNoun("AI Ethics", {
  type: "concept"
})

// Rich knowledge graph emerges
await brain.addVerb(researcher, researchPaper, "authors")
await brain.addVerb(researcher, institution, "affiliated")
await brain.addVerb(researchPaper, concept, "explores")
await brain.addVerb(institution, researchPaper, "publishes")
```

#### 4. **Domain Independence**
The same types work across all domains:

**Science:**
```typescript
await brain.addNoun("H2O", { type: "thing", category: "molecule" })
await brain.addNoun("Photosynthesis", { type: "process" })
await brain.addVerb(moleculeId, processId, "participates")
```

**Business:**
```typescript
await brain.addNoun("Q3 Revenue", { type: "metric", value: 10000000 })
await brain.addNoun("Sales Team", { type: "organization" })
await brain.addVerb(teamId, metricId, "achieves")
```

**Social:**
```typescript
await brain.addNoun("John", { type: "person" })
await brain.addNoun("Community Group", { type: "organization" })
await brain.addVerb(personId, groupId, "joins")
```

#### 5. **Temporal Coverage**
Handles all temporal aspects:
```typescript
// Past
await brain.addVerb(personId, companyId, "worked", {
  from: "2010", to: "2020"
})

// Present
await brain.addVerb(personId, projectId, "manages", {
  since: "2024-01-01"
})

// Future
await brain.addVerb(eventId, venueId, "scheduled", {
  date: "2025-06-15"
})
```

#### 6. **Hierarchical Representation**
Supports all levels of abstraction:
```typescript
// Micro level
await brain.addNoun("Electron", { type: "thing", scale: "quantum" })

// Macro level
await brain.addNoun("Solar System", { type: "place", scale: "astronomical" })

// Abstract level
await brain.addNoun("Justice", { type: "concept", domain: "philosophy" })
```

### Extensibility

While the core types cover all knowledge, you can extend with domain-specific subtypes:

```typescript
// Extend person for medical domain
await brain.addNoun("Patient #12345", {
  type: "person",
  subtype: "patient",
  medicalRecord: "MR-12345"
})

// Extend document for legal domain
await brain.addNoun("Contract ABC", {
  type: "document",
  subtype: "contract",
  jurisdiction: "California"
})

// Custom verb for specific domain
await brain.addVerb(lawyerId, contractId, "negotiates", {
  verbSubtype: "legal-action",
  billableHours: 10
})
```

### Knowledge Completeness Proof

The noun-verb taxonomy achieves **Turing completeness** for knowledge representation:

1. **Storage**: Any data can be stored as nouns
2. **Computation**: Any transformation can be expressed as verbs
3. **State**: Metadata captures all properties
4. **Relations**: Graph structure captures all connections
5. **Time**: Temporal metadata handles all time aspects
6. **Semantics**: Embeddings capture meaning and similarity

This makes Brainy capable of representing:
- Scientific knowledge
- Business intelligence  
- Social networks
- Historical records
- Creative content
- Technical documentation
- Personal information
- And any other form of human knowledge

## Conclusion

The Noun-Verb taxonomy in Brainy 2.0 provides a natural, flexible, and powerful way to model any domain. By thinking in terms of entities and their relationships, you can build everything from simple data stores to complex knowledge graphs while maintaining code clarity and query simplicity.

## See Also

- [Triple Intelligence](./triple-intelligence.md)
- [Natural Language Queries](../guides/natural-language.md)
- [API Reference](../api/README.md)