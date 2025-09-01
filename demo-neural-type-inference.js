// Demo: Neural Type Inference vs Basic Pattern Matching
import { 
  inferNounTypeFromMetadata, 
  inferNounTypeNeural 
} from './dist/utils/typeValidation.js'

console.log('🧠 Brainy Type Inference: Pattern vs Neural\n')
console.log('=' .repeat(50) + '\n')

// Test cases showing the difference
const testCases = [
  {
    name: 'Simple Person (both work)',
    data: { 
      email: 'john@example.com', 
      name: 'John Doe' 
    }
  },
  {
    name: 'Complex Role (neural understands context)',
    data: {
      title: 'Engineering Manager',
      responsibilities: 'Leads team, reviews code, mentors developers',
      department: 'Technology'
    }
  },
  {
    name: 'Ambiguous Entity (neural uses semantic understanding)',
    data: {
      name: 'Tesla',
      founded: 2003,
      employees: 127855,
      products: ['Model S', 'Model 3', 'Model X']
    }
  },
  {
    name: 'Scientific Content (neural recognizes research)',
    data: {
      title: 'Effects of quantum entanglement on superconductivity',
      abstract: 'This study examines the relationship between quantum states...',
      methodology: 'Double-blind controlled experiment',
      results: 'Statistical significance p<0.05'
    }
  },
  {
    name: 'Legal Document (neural understands context)',
    data: {
      parties: ['Company A', 'Company B'],
      effectiveDate: '2024-01-01',
      terms: 'Non-disclosure agreement',
      jurisdiction: 'California'
    }
  }
]

async function runComparison() {
  for (const testCase of testCases) {
    console.log(`📝 Test: ${testCase.name}`)
    console.log(`   Data: ${JSON.stringify(testCase.data, null, 2).split('\n').join('\n   ')}`)
    
    // Basic pattern matching (synchronous)
    const basicType = inferNounTypeFromMetadata(testCase.data)
    console.log(`   🔍 Basic Pattern Match: ${basicType || 'content (default)'}`)
    
    // Neural inference (async, uses embeddings)
    const neuralType = await inferNounTypeNeural(testCase.data)
    console.log(`   🧠 Neural Inference: ${neuralType}`)
    
    if (basicType !== neuralType) {
      console.log(`   ✨ Neural found better match!`)
    }
    
    console.log()
  }
}

runComparison().catch(console.error)