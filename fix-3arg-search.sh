#!/bin/bash

echo "Fixing 3-argument search() calls in test files..."

# Fix the most common 3-argument pattern: search(query, limit, { options })
find tests/ -name "*.test.ts" -exec grep -l "\.search([^,]*, [0-9]*, {" {} \; | while read file; do
    echo "Processing $file..."
    
    # Use a more sophisticated sed to handle 3-argument search calls
    # Pattern: .search("query", 10, { metadata: ... })
    # Replace with: .search("query", { limit: 10, metadata: ... })
    
    # This handles multiline cases by using perl instead of sed
    perl -i -pe 's/\.search\(([^,]+), (\d+), \{/\.search($1, { limit: $2,/g' "$file"
    
    echo "  ✅ Updated 3-argument search() calls in $file"
done

# Also handle manual test JavaScript files
find tests/manual-tests/ -name "*.js" -exec grep -l "\.search(" {} \; | while read file; do
    echo "Processing JS file $file..."
    
    # For JS files, also update the search signatures
    perl -i -pe 's/\.search\(([^,]+), (\d+)\)/\.search($1, { limit: $2 })/g' "$file"
    perl -i -pe 's/\.search\(([^,]+), (\d+), \{/\.search($1, { limit: $2,/g' "$file"
    
    echo "  ✅ Updated $file"
done

echo "🎉 Fixed 3-argument search() calls!"

# Verify the changes
echo ""
echo "🔍 Checking for any remaining old-style search() calls..."
remaining=$(find tests/ -name "*.test.ts" -o -name "*.js" | xargs grep -l "\.search([^,]*, [0-9]" | wc -l)

if [ $remaining -eq 0 ]; then
    echo "✅ All search() signatures updated successfully!"
else
    echo "⚠️  Found $remaining files that may still need manual review"
    find tests/ -name "*.test.ts" -o -name "*.js" | xargs grep -l "\.search([^,]*, [0-9]"
fi