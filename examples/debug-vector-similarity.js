/**
 * Debug script to analyze vector similarity scores for threshold tuning
 */

import { TypeInferenceSystem } from '../dist/query/typeInference.js';

async function debugVectorSimilarity() {
  console.log('🔍 Vector Similarity Threshold Analysis\n');
  console.log('='.repeat(60));

  // Create hybrid system with debug enabled
  const system = new TypeInferenceSystem({
    enableVectorFallback: true,
    fallbackConfidenceThreshold: 0.7,
    vectorThreshold: 0.3,  // Lower threshold to see more matches
    debug: true
  });

  // Test cases: unknown words, typos, medical terms
  const testQueries = [
    'Find documnets',           // Typo: document
    'Find cardiologists',       // Medical: person
    'Find oncologists',         // Medical: person
    'Find pysicians',          // Typo: physician -> person
    'Find organiztions',        // Typo: organization
    'Find kompanies',           // Severe typo: companies -> organization
    'Find xyzabc',              // Completely unknown
    'neurologist',              // Medical single word
    'cardiologist'              // Medical single word
  ];

  console.log('\n📊 Testing vector similarity with threshold = 0.3\n');

  for (const query of testQueries) {
    console.log(`\nQuery: "${query}"`);
    const start = performance.now();

    const results = await system.inferTypesAsync(query);

    const elapsed = performance.now() - start;

    if (results.length > 0) {
      console.log(`  ✅ Matched ${results.length} types in ${elapsed.toFixed(2)}ms:`);
      for (const result of results.slice(0, 3)) {
        console.log(`     - ${result.type}: ${(result.confidence * 100).toFixed(1)}% (${result.matchedKeywords.join(', ')})`);
      }
    } else {
      console.log(`  ❌ No matches in ${elapsed.toFixed(2)}ms`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Analysis complete! Use these insights to tune thresholds.');
  console.log('='.repeat(60));
}

debugVectorSimilarity().catch(err => {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
