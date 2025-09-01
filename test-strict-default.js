// Quick test: Verify strict mode is default
import { BrainyData } from './dist/brainyData.js'

// Test 1: Default config should be strict
const brain1 = new BrainyData({})
console.log('Test 1 - Default is strict:', brain1.typeCompatibilityMode === false ? '✅ PASS' : '❌ FAIL')

// Test 2: Empty config should be strict
const brain2 = new BrainyData()
console.log('Test 2 - No config is strict:', brain2.typeCompatibilityMode === false ? '✅ PASS' : '❌ FAIL')

// Test 3: Explicit false should be strict
const brain3 = new BrainyData({ typeCompatibilityMode: false })
console.log('Test 3 - Explicit false is strict:', brain3.typeCompatibilityMode === false ? '✅ PASS' : '❌ FAIL')

// Test 4: Only true enables compatibility
const brain4 = new BrainyData({ typeCompatibilityMode: true })
console.log('Test 4 - True enables compat:', brain4.typeCompatibilityMode === true ? '✅ PASS' : '❌ FAIL')

console.log('\n✨ Summary: Strict mode is now the default!')