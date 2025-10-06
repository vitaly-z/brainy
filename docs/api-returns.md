# Brainy API Return Values

## Core Operations

### `brain.add()` - Adding Entities

**Returns:** `Promise<string>` - The ID of the created entity

```typescript
// ✅ Correct usage - add() returns the ID string directly
const id = await brain.add({
  type: 'document',
  data: 'My document content'
})

console.log('Created entity with ID:', id)

// Use the ID to create relationships
await brain.relate({
  from: id,
  to: anotherId,
  type: 'references'
})
```

```typescript
// ❌ Incorrect - trying to access .id property
const result = await brain.add({
  type: 'document',
  data: 'My content'
})

console.log(result.id) // ❌ undefined - result IS the ID, not an object!
```

### Getting the Full Entity

If you need the full entity object after creation, use `brain.get()`:

```typescript
// Add entity and get its ID
const id = await brain.add({
  type: 'document',
  data: 'My content',
  metadata: { label: 'Important Doc' }
})

// Get the full entity
const entity = await brain.get(id)
console.log(entity.id)          // The ID
console.log(entity.type)        // 'document'
console.log(entity.data)        // 'My content'
console.log(entity.metadata)    // { label: 'Important Doc', ... }
console.log(entity.vector)      // The embedding vector
console.log(entity.createdAt)   // Timestamp
```

### `brain.find()` - Finding Entities

**Returns:** `Promise<Entity[]>` - Array of full entity objects

```typescript
const entities = await brain.find({
  query: 'machine learning',
  limit: 10
})

// Each entity has full information
for (const entity of entities) {
  console.log(entity.id)
  console.log(entity.type)
  console.log(entity.data)
  console.log(entity.metadata)
}
```

### `brain.relate()` - Creating Relationships

**Returns:** `Promise<string>` - The ID of the created relationship

```typescript
const relationId = await brain.relate({
  from: entityId1,
  to: entityId2,
  type: 'references'
})

console.log('Created relationship with ID:', relationId)
```

## Data Field Behavior

### String Data - Used for Embeddings

When `data` is a string, it's used to generate embeddings for semantic search:

```typescript
await brain.add({
  type: 'document',
  data: 'This text will be converted to an embedding vector',
  metadata: {
    title: 'My Document',
    year: 2024
  }
})
```

### Object Data - Structured Information

When `data` is an object, it's treated as structured data:

```typescript
await brain.add({
  type: 'product',
  data: {
    name: 'Widget',
    price: 29.99,
    category: 'Tools'
  },
  vector: precomputedVector  // Must provide vector when using object data
})
```

**Important:** If you provide object data without a `vector`, you must include a string somewhere for embedding generation, or the operation will fail.

### Metadata vs Data

- **`data`**: Primary content - used for embeddings (if string) or stored as structured data (if object)
- **`metadata`**: Auxiliary information - always stored as structured data, used for filtering

**Best practice for labels:**
```typescript
await brain.add({
  type: 'document',
  data: 'The full text content of the document...',  // For semantic search
  metadata: {
    label: 'Quick Reference Label',  // For display
    author: 'John Doe',
    category: 'Technical'
  }
})
```

## Summary

| Method | Returns | Contains |
|--------|---------|----------|
| `brain.add()` | `string` | The ID of the created entity |
| `brain.get()` | `Entity \| null` | Full entity object with all fields |
| `brain.find()` | `Entity[]` | Array of full entity objects |
| `brain.relate()` | `string` | The ID of the created relationship |
| `brain.getRelations()` | `Relation[]` | Array of relationship objects |
