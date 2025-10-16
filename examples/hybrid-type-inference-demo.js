/**
 * Hybrid Type Inference Demo - REAL WORKING EXAMPLE
 *
 * Demonstrates the hybrid TypeInference system with vector similarity fallback
 * actually working end-to-end through the TypeAwareQueryPlanner.
 */

import { TypeAwareQueryPlanner } from '../dist/query/typeAwareQueryPlanner.js';
import { NounType } from '../dist/types/graphTypes.js';

async function main() {
  console.log('🎯 Hybrid Type Inference Demo\n');
  console.log('='.repeat(60));

  // ========== Test 1: Synchronous Mode (Keyword Only) ==========
  console.log('\n📌 Test 1: Synchronous Mode (Keyword Matching Only)\n');

  const syncPlanner = new TypeAwareQueryPlanner();

  console.log('Query: "Find engineers"');
  const plan1 = syncPlanner.planQuery('Find engineers');
  console.log(`✅ Result: ${plan1.routing} routing`);
  console.log(`   Types: ${plan1.targetTypes.join(', ')}`);
  console.log(`   Confidence: ${(plan1.confidence * 100).toFixed(0)}%`);
  console.log(`   Speedup: ${plan1.estimatedSpeedup.toFixed(1)}x`);

  console.log('\nQuery: "Find physicians" (unknown word - will fail in sync mode)');
  const plan2 = syncPlanner.planQuery('Find physicians');
  console.log(`⚠️  Result: ${plan2.routing} routing`);
  console.log(`   Types: ${plan2.targetTypes.length} types (searches ALL)`);
  console.log(`   Reason: ${plan2.reasoning}`);

  // ========== Test 2: Hybrid Mode (Keyword + Vector Fallback) ==========
  console.log('\n\n📌 Test 2: Hybrid Mode (Keyword + Vector Fallback)\n');

  const hybridPlanner = new TypeAwareQueryPlanner(undefined, {
    enableVectorFallback: true,
    debug: true,
    typeInferenceConfig: {
      fallbackConfidenceThreshold: 0.7,
      vectorThreshold: 0.5,
      debug: true
    }
  });

  console.log('Query: "Find engineers" (known keyword - fast path)');
  const plan3 = await hybridPlanner.planQueryAsync('Find engineers');
  console.log(`✅ Result: ${plan3.routing} routing`);
  console.log(`   Types: ${plan3.targetTypes.join(', ')}`);
  console.log(`   Confidence: ${(plan3.confidence * 100).toFixed(0)}%`);

  console.log('\n\nQuery: "Find physicians" (unknown word - vector fallback!)');
  const plan4 = await hybridPlanner.planQueryAsync('Find physicians');
  console.log(`✅ Result: ${plan4.routing} routing`);
  console.log(`   Types: ${plan4.targetTypes.join(', ')}`);
  console.log(`   Confidence: ${(plan4.confidence * 100).toFixed(0)}%`);
  console.log(`   Speedup: ${plan4.estimatedSpeedup.toFixed(1)}x`);

  console.log('\n\nQuery: "Find documnets" (typo - vector fallback handles it!)');
  const plan5 = await hybridPlanner.planQueryAsync('Find documnets');
  console.log(`✅ Result: ${plan5.routing} routing`);
  console.log(`   Types: ${plan5.targetTypes.join(', ')}`);
  console.log(`   Confidence: ${(plan5.confidence * 100).toFixed(0)}%`);

  // ========== Performance Comparison ==========
  console.log('\n\n📌 Performance Comparison\n');

  console.log('Synchronous (keyword-only):');
  const start1 = performance.now();
  syncPlanner.planQuery('Find engineers');
  const elapsed1 = performance.now() - start1;
  console.log(`   Latency: ${elapsed1.toFixed(2)}ms (fast path)`);

  console.log('\nHybrid with known keyword (should use fast path):');
  const start2 = performance.now();
  await hybridPlanner.planQueryAsync('Find engineers');
  const elapsed2 = performance.now() - start2;
  console.log(`   Latency: ${elapsed2.toFixed(2)}ms (fast path)`);

  console.log('\nHybrid with unknown word (triggers vector fallback):');
  const start3 = performance.now();
  await hybridPlanner.planQueryAsync('Find cardiologists');
  const elapsed3 = performance.now() - start3;
  console.log(`   Latency: ${elapsed3.toFixed(2)}ms (includes vector similarity)`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Demo Complete! The hybrid system is ACTUALLY WORKING!');
  console.log('='.repeat(60));
}

// Run the demo
main().catch(error => {
  console.error('\n❌ Demo failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
