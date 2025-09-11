#!/bin/bash

# Script to migrate tests from old Brainy API to v3.0 API
# This updates deprecated methods and types

echo "🔄 Migrating tests to Brainy 3.0 API..."

# List of test files to update
TEST_FILES=(
  "tests/integration/brainy-core.integration.test.ts"
  "tests/integration/brainy-complete.integration.test.ts"
)

for file in "${TEST_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "📝 Updating $file..."
    
    # Backup original
    cp "$file" "$file.backup"
    
    # Replace BrainyData with Brainy
    sed -i 's/BrainyData/Brainy/g' "$file"
    
    # Replace addNoun with add (using proper params)
    sed -i "s/brain\.addNoun(\([^,)]*\))/brain.add({ data: \1, type: 'thing' })/g" "$file"
    sed -i "s/brain\.addNoun(\([^,]*\), \([^)]*\))/brain.add({ data: \1, type: 'thing', metadata: \2 })/g" "$file"
    
    # Replace addVerb with relate
    sed -i "s/brain\.addVerb(\([^,]*\), \([^,]*\), \([^)]*\))/brain.relate({ from: \1, to: \2, type: \3 })/g" "$file"
    
    # Replace getNoun with get
    sed -i 's/brain\.getNoun/brain.get/g' "$file"
    
    # Replace getVerb with getRelations
    sed -i 's/brain\.getVerb/brain.getRelations/g' "$file"
    
    # Replace GraphNoun with Entity
    sed -i 's/GraphNoun/Entity/g' "$file"
    
    # Replace GraphVerb with Relation
    sed -i 's/GraphVerb/Relation/g' "$file"
    
    # Update import statements
    sed -i "s/import { Brainy } from '..\/..\/dist\/index.js'/import { Brainy } from '..\/..\/src\/brainy'/g" "$file"
    
    # Fix forceMemoryStorage to new format
    sed -i "s/storage: { forceMemoryStorage: true }/storage: { type: 'memory' }/g" "$file"
    
    echo "✅ Updated $file"
  fi
done

echo "📊 Migration complete! Review the changes and run tests to verify."
echo "💡 Backup files created with .backup extension"