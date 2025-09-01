// Demo: Type Enforcement in Brainy
import { BrainyData, NounType, VerbType } from './dist/index.js'

async function demo() {
  console.log('🧠 Brainy Type Enforcement Demo\n')
  console.log('================================\n')

  // Create instance in compatibility mode (default)
  const brain = new BrainyData({ 
    storage: { forceMemoryStorage: true },
    logging: { verbose: true } // Show warnings
  })
  await brain.init()

  console.log('📝 Test 1: New API with explicit types')
  console.log('----------------------------------------')
  
  // New API - explicit types
  const personId = await brain.addNoun(
    'John Doe is a software engineer', 
    NounType.Person,
    { role: 'Engineer', experience: 5 }
  )
  console.log(`✅ Added person with ID: ${personId}\n`)

  const docId = await brain.addNoun(
    'Technical documentation for the API',
    NounType.Document,
    { title: 'API Docs', version: '2.0' }
  )
  console.log(`✅ Added document with ID: ${docId}\n`)

  console.log('📝 Test 2: Old API with deprecation warning')
  console.log('--------------------------------------------')
  
  // Old API - will show deprecation warning
  const contentId = await brain.addNoun(
    'Some content without explicit type',
    { description: 'This uses the old API' }
  )
  console.log(`✅ Added content with ID: ${contentId}\n`)

  console.log('📝 Test 3: Type inference from metadata')
  console.log('----------------------------------------')
  
  // Will infer Person type from email
  const userId = await brain.addNoun(
    'Jane Smith profile',
    { email: 'jane@example.com', username: 'jsmith' }
  )
  console.log(`✅ Added user (inferred Person type) with ID: ${userId}\n`)

  console.log('📝 Test 4: Invalid type with helpful suggestion')
  console.log('------------------------------------------------')
  
  try {
    // Typo in type name
    await brain.addNoun(
      'Test data',
      'persan', // Typo!
      {}
    )
  } catch (error) {
    console.log(`❌ Error (as expected): ${error.message}\n`)
  }

  console.log('📝 Test 5: Strict mode enforcement')
  console.log('-----------------------------------')
  
  // Create new instance in strict mode
  const strictBrain = new BrainyData({ 
    storage: { forceMemoryStorage: true },
    typeCompatibilityMode: false, // Strict mode!
    logging: { verbose: false }
  })
  await strictBrain.init()

  try {
    // This will fail in strict mode
    await strictBrain.addNoun('Test', { meta: 'data' })
  } catch (error) {
    console.log(`❌ Strict mode error (as expected): ${error.message}\n`)
  }

  // This will work in strict mode
  const strictId = await strictBrain.addNoun(
    'Valid data with type',
    NounType.Content,
    { valid: true }
  )
  console.log(`✅ Strict mode success with ID: ${strictId}\n`)

  console.log('📝 Test 6: Verify types are stored correctly')
  console.log('---------------------------------------------')
  
  const person = await brain.getNoun(personId)
  console.log(`Person noun type: ${person.metadata.noun}`)
  console.log(`Person metadata:`, person.metadata)
  
  const doc = await brain.getNoun(docId)
  console.log(`\nDocument noun type: ${doc.metadata.noun}`)
  console.log(`Document metadata:`, doc.metadata)

  console.log('\n✨ Demo complete!')
}

demo().catch(console.error)