import { describe, it, expect } from 'vitest'
import { BrainyData } from '../dist/unified.js'

describe('Vector Dimension Standardization', () => {
  it('should initialize BrainyData with 384 dimensions', async () => {
    // Initialize BrainyData
    const db = new BrainyData()
    await db.init()
    
    // Check the dimensions property
    expect(db.dimensions).toBe(384)
  })

  it('should reject vectors with incorrect dimensions', async () => {
    const db = new BrainyData()
    await db.init()
    
    // Test with a simple vector (this should throw an error because it's not 384 dimensions)
    const smallVector = [0.1, 0.2, 0.3]
    
    // Expect the add operation to throw an error
    await expect(db.add(smallVector, { test: 'small-vector' }))
      .rejects.toThrow()
  })

  it('should successfully embed text to 384 dimensions', async () => {
    const db = new BrainyData()
    await db.init()
    
    // Test with text that will be embedded to 384 dimensions
    const id = await db.add('This is a test text that will be embedded to 384 dimensions', { test: 'text-embedding' })
    
    // Retrieve the vector and check its dimensions
    const noun = await db.get(id)
    expect(noun.vector.length).toBe(384)
  })

  it('should directly embed text to 384 dimensions', async () => {
    const db = new BrainyData()
    await db.init()
    
    // Test direct embedding
    const vector = await db.embed('Another test text')
    expect(vector.length).toBe(384)
  })

  it('should ALWAYS use 384 dimensions - NOT configurable by design', async () => {
    // Dimensions are HARDCODED to 384 for all-MiniLM-L6-v2 model
    // This is NOT configurable and any attempt to configure it should be ignored
    // This ensures everything works together correctly
    const db = new BrainyData({
      // Even if someone tries to pass dimensions, it's ignored
      // @ts-ignore - Testing that even invalid config doesn't break things
      dimensions: 300
    })
    await db.init()
    
    // MUST always be 384 - this is critical for the system to work
    expect(db.dimensions).toBe(384)
  })
})
