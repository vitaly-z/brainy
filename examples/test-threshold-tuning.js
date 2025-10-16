/**
 * Test different vector thresholds to find optimal balance
 */

import { TypeInferenceSystem } from '../dist/query/typeInference.js';

async function testThresholds() {
  console.log('🎯 Vector Threshold Tuning Test\n');
  console.log('='.repeat(60));

  // Test queries: typos and edge cases
  const testCases = [
    { query: 'Find pysicians', expected: 'person', description: 'Typo: physician' },
    { query: 'Find documnets', expected: 'document', description: 'Typo: documents' },
    { query: 'Find organiztions', expected: 'organization', description: 'Typo: organizations' },
    { query: 'Find kompanies', expected: 'organization', description: 'Severe typo: companies' },
    { query: 'Find enginners', expected: 'person', description: 'Typo: engineers' },
    { query: 'Find xyzabc', expected: null, description: 'Nonsense word (should fail)' }
  ];

  // Test with different thresholds
  const thresholds = [0.35, 0.30, 0.25, 0.20];

  for (const threshold of thresholds) {
    console.log(`\n📊 Testing with vectorThreshold = ${threshold}`);
    console.log('-'.repeat(60));

    const system = new TypeInferenceSystem({
      enableVectorFallback: true,
      fallbackConfidenceThreshold: 0.7,
      vectorThreshold: threshold,
      debug: false
    });

    let successes = 0;
    let falsePositives = 0;

    for (const testCase of testCases) {
      const results = await system.inferTypesAsync(testCase.query);
      const matched = results.length > 0;
      const correctType = results.length > 0 && results[0].type === testCase.expected;

      if (testCase.expected === null) {
        // Should NOT match
        if (!matched) {
          successes++;
          console.log(`  ✅ "${testCase.query}" correctly returned no matches`);
        } else {
          falsePositives++;
          console.log(`  ❌ "${testCase.query}" false positive: ${results[0].type} (${(results[0].confidence * 100).toFixed(1)}%)`);
        }
      } else {
        // Should match expected type
        if (correctType) {
          successes++;
          console.log(`  ✅ "${testCase.query}" → ${results[0].type} (${(results[0].confidence * 100).toFixed(1)}%)`);
        } else if (matched) {
          console.log(`  ⚠️  "${testCase.query}" → ${results[0].type} (expected ${testCase.expected})`);
        } else {
          console.log(`  ❌ "${testCase.query}" no match (expected ${testCase.expected})`);
        }
      }
    }

    const accuracy = (successes / testCases.length) * 100;
    console.log(`\n  Accuracy: ${successes}/${testCases.length} (${accuracy.toFixed(0)}%), False positives: ${falsePositives}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Threshold tuning complete!');
  console.log('='.repeat(60));
}

testThresholds().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
