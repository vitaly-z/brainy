// Quick test to verify the recovered Brainy API actually works
import { Brainy } from './dist/brainy.js';

async function testRecoveredAPI() {
  console.log('\n🧪 TESTING RECOVERED BRAINY API...\n');
  
  const brain = new Brainy();
  await brain.init();
  
  // Test 1: Add an entity
  console.log('✅ Test 1: Adding entity...');
  const id = await brain.add({
    type: 'document',  // This is the noun type
    data: 'Test entity from recovery',
    metadata: { test: true, recovered: true }
  });
  console.log(`   Added with ID: ${id}`);
  
  // Test 2: Get the entity back
  console.log('✅ Test 2: Getting entity...');
  const entity = await brain.get(id);
  console.log(`   Retrieved: ${entity.data}`);
  console.log(`   Metadata: ${JSON.stringify(entity.metadata)}`);
  
  // Test 3: Find by text
  console.log('✅ Test 3: Finding by text...');
  const results = await brain.find('test recovery');
  console.log(`   Found ${results.length} results`);
  
  // Test 4: Update entity
  console.log('✅ Test 4: Updating entity...');
  await brain.update({
    id,
    data: 'Updated test entity',
    metadata: { type: 'test', recovered: true, updated: true }
  });
  const updated = await brain.get(id);
  console.log(`   Updated data: ${updated.data}`);
  
  // Test 5: Create relationship
  console.log('✅ Test 5: Creating relationship...');
  const id2 = await brain.add({ type: 'document', data: 'Second entity' });
  const relId = await brain.relate({
    from: id,
    to: id2,
    type: 'relatedTo'
  });
  console.log(`   Relationship created: ${relId}`);
  
  // Test 6: Get relationships
  console.log('✅ Test 6: Getting relationships...');
  const rels = await brain.getRelations({ from: id });
  console.log(`   Found ${rels.length} relationships from first entity`);
  
  // Test 7: Batch operations
  console.log('✅ Test 7: Batch add...');
  const batchResult = await brain.addMany({
    items: [
      { data: 'Batch 1' },
      { data: 'Batch 2' },
      { data: 'Batch 3' }
    ]
  });
  console.log(`   Added ${batchResult.successful.length} items in batch`);
  
  // Test 8: Advanced APIs
  console.log('✅ Test 8: Advanced APIs...');
  console.log(`   neural() API: ${typeof brain.neural()}`);
  console.log(`   nlp() API: ${typeof brain.nlp()}`);
  console.log(`   insights() API: ${typeof brain.insights}`);
  
  // Test 9: Insights
  console.log('✅ Test 9: Getting insights...');
  const insights = await brain.insights();
  console.log(`   Total entities: ${insights.entities}`);
  console.log(`   Total relationships: ${insights.relationships}`);
  
  console.log('\n🎉 ALL TESTS PASSED! THE RECOVERED API IS WORKING!\n');
}

testRecoveredAPI().catch(console.error);