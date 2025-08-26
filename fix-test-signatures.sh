#!/bin/bash

echo "Fixing search() API signatures in test files..."

# Fix unified-api.test.ts
echo "Updating unified-api.test.ts..."
sed -i 's/brainy\.search(\([^,]*\), \([0-9]\+\))/brainy.search(\1, { limit: \2 })/g' tests/unified-api.test.ts

# Fix consistent-api.test.ts  
echo "Updating consistent-api.test.ts..."
sed -i 's/brainy\.search(\([^,]*\), \([0-9]\+\))/brainy.search(\1, { limit: \2 })/g' tests/consistent-api.test.ts
sed -i 's/brain\.search(\([^,]*\), \([0-9]\+\))/brain.search(\1, { limit: \2 })/g' tests/consistent-api.test.ts

# Fix any other test files that might have old signatures
echo "Scanning for other test files with old search() signatures..."
find tests/ -name "*.test.ts" -exec grep -l "\.search([^,]*, [0-9]" {} \; | while read file; do
    echo "Updating $file..."
    sed -i 's/\.search(\([^,]*\), \([0-9]\+\))/\.search(\1, { limit: \2 })/g' "$file"
done

echo "✅ Fixed search() signatures in test files"

# Also handle any 3-argument search calls
echo "Fixing 3-argument search() calls..."
find tests/ -name "*.test.ts" -exec grep -l "\.search([^,]*, [0-9], {" {} \; | while read file; do
    echo "Updating 3-arg search() in $file..."
    # This is trickier, need manual inspection for complex cases
    echo "  📝 NOTE: $file may need manual review for 3-argument search() calls"
done

echo "🎉 Test signature update complete!"