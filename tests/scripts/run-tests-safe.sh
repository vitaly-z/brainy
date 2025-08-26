#!/bin/bash

# Safe test runner with memory management
# Runs tests in groups to avoid OOM errors

echo "🧠 Brainy Test Runner - Memory Safe Mode"
echo "========================================="

# Set environment variables
export BRAINY_MODELS_PATH=./models
export BRAINY_ALLOW_REMOTE_MODELS=false
export NODE_OPTIONS="--max-old-space-size=2048"

# Track results
TOTAL_PASSED=0
TOTAL_FAILED=0
FAILED_TESTS=""

# Function to run a test group
run_test_group() {
    local group_name=$1
    local test_pattern=$2
    
    echo ""
    echo "📊 Running: $group_name"
    echo "----------------------------------------"
    
    # Run tests and capture output
    if npx vitest run $test_pattern --reporter=verbose 2>&1 | tee test-output.tmp | grep -E "(Test Files|Tests)" | tail -2; then
        # Extract pass/fail counts
        local result=$(tail -2 test-output.tmp | grep -E "(passed|failed)")
        echo "$result"
        
        # Parse results (basic parsing, might need adjustment)
        if echo "$result" | grep -q "failed"; then
            FAILED_TESTS="$FAILED_TESTS\n  - $group_name"
            ((TOTAL_FAILED++))
        else
            ((TOTAL_PASSED++))
        fi
    else
        echo "  ❌ Test group failed to run"
        FAILED_TESTS="$FAILED_TESTS\n  - $group_name (crashed)"
        ((TOTAL_FAILED++))
    fi
    
    # Clean up temp file
    rm -f test-output.tmp
    
    # Force garbage collection pause
    sleep 2
}

# Run test groups
echo "🚀 Starting test execution..."

# Group 1: Core functionality
run_test_group "Core API Tests" "tests/core.test.ts tests/consistent-api.test.ts tests/unified-api.test.ts"

# Group 2: Intelligent features
run_test_group "Intelligent Features" "tests/intelligent-verb-scoring.test.ts tests/neural-import.test.ts tests/neural-clustering.test.ts"

# Group 3: Augmentations
run_test_group "Augmentations" "tests/augmentations-*.test.ts"

# Group 4: Storage
run_test_group "Storage Adapters" "tests/storage-adapter-coverage.test.ts tests/opfs-storage.test.ts"

# Group 5: Vector operations
run_test_group "Vector Operations" "tests/vector-operations.test.ts tests/dimension-standardization.test.ts"

# Group 6: Triple Intelligence
run_test_group "Triple Intelligence" "tests/triple-intelligence.test.ts tests/metadata-filter.test.ts"

# Group 7: Performance (lighter tests)
run_test_group "Performance Tests" "tests/performance.test.ts tests/pagination.test.ts"

# Group 8: Edge cases
run_test_group "Edge Cases & Error Handling" "tests/edge-cases.test.ts tests/error-handling.test.ts"

# Group 9: Zero config
run_test_group "Zero Config" "tests/zero-config-models.test.ts tests/auto-configuration.test.ts"

# Group 10: Model loading
run_test_group "Model Loading" "tests/model-loading.test.ts"

# Summary
echo ""
echo "========================================="
echo "📈 TEST SUMMARY"
echo "========================================="
echo "✅ Passed: $TOTAL_PASSED test groups"
echo "❌ Failed: $TOTAL_FAILED test groups"

if [ ! -z "$FAILED_TESTS" ]; then
    echo ""
    echo "Failed groups:"
    echo -e "$FAILED_TESTS"
fi

echo ""
echo "========================================="

# Exit with appropriate code
if [ $TOTAL_FAILED -gt 0 ]; then
    echo "❌ Tests failed. Please fix before release."
    exit 1
else
    echo "✅ All test groups passed!"
    exit 0
fi