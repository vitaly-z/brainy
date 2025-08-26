#!/bin/bash

# Comprehensive test runner with proper memory management
# Runs ALL tests with adequate memory allocation

echo "🧠 Brainy 2.0 Complete Test Suite with Memory Management"
echo "========================================================="
echo ""

# Set environment for ALL tests
export NODE_OPTIONS='--max-old-space-size=16384'
export BRAINY_MODELS_PATH=./models
export BRAINY_ALLOW_REMOTE_MODELS=false

# Use our memory-optimized vitest config
export VITEST_CONFIG=./vitest.config.memory.ts

echo "📊 Configuration:"
echo "  - Node heap: 16GB"
echo "  - Models: Local only"
echo "  - Tests: Sequential execution"
echo "  - Timeout: 2 minutes per test"
echo ""

# Build first
echo "🔨 Building TypeScript..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed! Fix TypeScript errors first."
  exit 1
fi
echo "✅ Build successful"
echo ""

# Run all tests with memory config
echo "🧪 Running all tests..."
npm test -- --config ./vitest.config.memory.ts --reporter=verbose 2>&1 | tee full-test-output.log

# Extract summary
echo ""
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="

# Count results
PASSED=$(grep -c "✓" full-test-output.log 2>/dev/null || echo 0)
FAILED=$(grep -c "×" full-test-output.log 2>/dev/null || echo 0)
SKIPPED=$(grep -c "↓" full-test-output.log 2>/dev/null || echo 0)

echo "✅ Passed:  $PASSED"
echo "❌ Failed:  $FAILED"
echo "⏭️  Skipped: $SKIPPED"
echo "📊 Total:   $((PASSED + FAILED + SKIPPED))"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 SUCCESS! All tests passed!"
  echo ""
  echo "Ready for release:"
  echo "  npm version patch"
  echo "  npm publish"
  exit 0
else
  echo "⚠️  $FAILED tests failed."
  echo ""
  echo "Common issues:"
  echo "1. Out of memory → Increase NODE_OPTIONS"
  echo "2. Timeout → Tests need more than 2 minutes"
  echo "3. clearAll → Must use { force: true }"
  echo ""
  echo "Check full-test-output.log for details."
  exit 1
fi