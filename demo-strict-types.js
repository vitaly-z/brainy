// Demo: Strict Type Enforcement (Now Default!)
import { BrainyData, NounType } from './dist/index.js'

async function demo() {
  console.log('🚨 Brainy 3.0: Strict Types by Default!\n')
  console.log('=' .repeat(50) + '\n')

  // Create instance with default config (STRICT MODE)
  const brain = new BrainyData({ 
    storage: { forceMemoryStorage: true }
  })
  await brain.init()

  console.log('❌ Test 1: Old API fails by default')
  console.log('----------------------------------------')
  try {
    // This WILL FAIL - no type specified
    await brain.addNoun('Some data', { metadata: 'stuff' })
  } catch (error) {
    console.log('Error (expected):', error.message.split('\n')[0])
    console.log('✅ Good! Forces you to specify type.\n')
  }

  console.log('✅ Test 2: New API with explicit types works')
  console.log('---------------------------------------------')
  
  const personId = await brain.addNoun(
    'John Doe', 
    NounType.Person,
    { role: 'Engineer' }
  )
  console.log(`Added person with ID: ${personId}`)

  const docId = await brain.addNoun(
    'API Documentation',
    NounType.Document,
    { version: '2.0' }
  )
  console.log(`Added document with ID: ${docId}\n`)

  console.log('🔄 Test 3: Compatibility mode (opt-in only)')
  console.log('--------------------------------------------')
  
  // Must explicitly enable compatibility mode
  const compatBrain = new BrainyData({ 
    storage: { forceMemoryStorage: true },
    typeCompatibilityMode: true, // EXPLICIT OPT-IN
    logging: { verbose: false }
  })
  await compatBrain.init()

  // Now old API works (with warnings if verbose: true)
  const oldApiId = await compatBrain.addNoun(
    'Old style data',
    { someField: 'value' }
  )
  console.log(`Compatibility mode allows old API: ${oldApiId}\n`)

  console.log('📊 Summary: Why Strict Mode is Better')
  console.log('--------------------------------------')
  console.log('1. Forces explicit types → Better data quality')
  console.log('2. No ambiguous "content" everywhere')
  console.log('3. AI works better with typed data')
  console.log('4. Prevents technical debt')
  console.log('5. Can always opt-in to compatibility if needed')
  console.log('\n✨ Brainy 3.0: Type Safety First!')
}

// Bypass version check for demo
process.env.BRAINY_SKIP_VERSION_CHECK = 'true'
demo().catch(console.error)