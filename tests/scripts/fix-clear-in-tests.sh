#!/bin/bash

# Fix all .clear() calls to .clearAll({ force: true }) in tests

echo "🔧 Fixing clear() calls in test files..."

# Find and replace in all test files
for file in tests/*.test.ts; do
  if grep -q "\.clear()" "$file"; then
    echo "  Fixing: $file"
    # Replace various patterns
    sed -i 's/\.clear()/\.clearAll({ force: true })/g' "$file"
    sed -i 's/\.clearAll({ force: true }) \/\/ Clear any existing data/\.clearAll({ force: true }) \/\/ Clear any existing data/g' "$file"
  fi
done

echo "✅ Fixed all clear() calls to clearAll({ force: true })"
echo ""
echo "Files modified:"
grep -l "clearAll({ force: true })" tests/*.test.ts | sed 's/^/  - /'