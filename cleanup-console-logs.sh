#!/bin/bash

# Cleanup console.log statements in Brainy source code
# Keeps only essential status messages with emojis

echo "🧹 Cleaning up console.log statements..."

# Count before
BEFORE=$(grep -r "console.log" src/ | wc -l)
echo "Found $BEFORE console.log statements"

# Files to process
FILES=$(find src -name "*.ts" -type f)

for file in $FILES; do
  # Create backup
  cp "$file" "$file.bak"
  
  # Remove debug console.logs (those without status emojis)
  # Keep lines with: ✅ 🔍 🧠 🚀 ✓ 🤖 📊 🔄 🎯 ❌ 📡 🧹 ⚠️ 💾
  sed -i '/console\.log/!b; /✅\|🔍\|🧠\|🚀\|✓\|🤖\|📊\|🔄\|🎯\|❌\|📡\|🧹\|⚠️\|💾/!d' "$file"
  
  # Check if file changed
  if ! diff -q "$file" "$file.bak" > /dev/null; then
    echo "  Cleaned: $file"
  fi
  
  # Remove backup
  rm "$file.bak"
done

# Count after
AFTER=$(grep -r "console.log" src/ | wc -l)
echo "Removed $((BEFORE - AFTER)) console.log statements"
echo "Remaining: $AFTER (status messages)"

echo "✅ Cleanup complete!"