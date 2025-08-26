#!/bin/bash

# Run all Brainy tests sequentially with memory management
# This prevents memory exhaustion from parallel test execution

echo "🧠 Running Brainy 2.0 Complete Test Suite"
echo "========================================"
echo "Memory: 16GB allocated per test batch"
echo ""

# Set Node options for all tests
export NODE_OPTIONS='--max-old-space-size=16384'
export BRAINY_MODELS_PATH=./models
export BRAINY_ALLOW_REMOTE_MODELS=false

# Counter for tracking results
PASSED=0
FAILED=0
SKIPPED=0
TOTAL=0

# Run tests in batches to prevent memory exhaustion
echo "📦 Batch 1: Core Tests"
echo "----------------------"
npm test -- --run tests/core.test.ts 2>&1 | tee batch1.log | grep -E "✓|×|↓" | tail -20
echo ""

echo "📦 Batch 2: Triple Intelligence & Neural"
echo "----------------------------------------"
npm test -- --run tests/triple-intelligence.test.ts tests/neural-api.test.ts 2>&1 | tee batch2.log | grep -E "✓|×|↓" | tail -20
echo ""

echo "📦 Batch 3: Metadata & Performance"
echo "-----------------------------------"
npm test -- --run tests/metadata-*.test.ts 2>&1 | tee batch3.log | grep -E "✓|×|↓" | tail -20
echo ""

echo "📦 Batch 4: Storage & Database"
echo "-------------------------------"
npm test -- --run tests/database-operations.test.ts tests/storage-adapter-coverage.test.ts 2>&1 | tee batch4.log | grep -E "✓|×|↓" | tail -20
echo ""

echo "📦 Batch 5: Augmentations"
echo "-------------------------"
npm test -- --run tests/augmentations-*.test.ts 2>&1 | tee batch5.log | grep -E "✓|×|↓" | tail -20
echo ""

echo "📦 Batch 6: API & Consistency"
echo "-----------------------------"
npm test -- --run tests/consistent-api.test.ts tests/unified-api.test.ts 2>&1 | tee batch6.log | grep -E "✓|×|↓" | tail -20
echo ""

echo "📦 Batch 7: Environment & Edge Cases"
echo "-------------------------------------"
npm test -- --run tests/environment.*.test.ts tests/edge-cases.test.ts 2>&1 | tee batch7.log | grep -E "✓|×|↓" | tail -20
echo ""

echo "📦 Batch 8: Find & NLP"
echo "----------------------"
npm test -- --run tests/find-comprehensive.test.ts tests/nlp-patterns-comprehensive.test.ts 2>&1 | tee batch8.log | grep -E "✓|×|↓" | tail -20
echo ""

echo "📦 Batch 9: Regression & Validation"
echo "------------------------------------"
npm test -- --run tests/regression.test.ts tests/release-*.test.ts 2>&1 | tee batch9.log | grep -E "✓|×|↓" | tail -20
echo ""

echo "📦 Batch 10: Other Tests"
echo "------------------------"
npm test -- --run tests/distributed*.test.ts tests/cli.test.ts tests/brainy-chat.test.ts tests/pagination.test.ts tests/vector-operations.test.ts tests/error-handling.test.ts tests/specialized-scenarios.test.ts tests/multi-environment.test.ts tests/statistics.test.ts tests/type-utils.test.ts 2>&1 | tee batch10.log | grep -E "✓|×|↓" | tail -20
echo ""

# Aggregate results
echo ""
echo "=========================================="
echo "🎯 FINAL TEST RESULTS"
echo "=========================================="

# Count passed/failed from all logs
PASSED=$(cat batch*.log 2>/dev/null | grep -c "✓" || echo 0)
FAILED=$(cat batch*.log 2>/dev/null | grep -c "×" || echo 0)
SKIPPED=$(cat batch*.log 2>/dev/null | grep -c "↓" || echo 0)
TOTAL=$((PASSED + FAILED + SKIPPED))

echo "✅ Passed:  $PASSED"
echo "❌ Failed:  $FAILED"
echo "⏭️  Skipped: $SKIPPED"
echo "📊 Total:   $TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 SUCCESS! All tests passed!"
  exit 0
else
  echo "⚠️  Some tests failed. Check individual batch logs for details."
  exit 1
fi