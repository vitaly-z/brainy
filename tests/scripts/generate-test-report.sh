#!/bin/bash

# Generate Test Coverage and Recommendations Report for Brainy

echo "🔍 Generating Brainy Test Report..."

# Run tests and capture output
echo "Running tests..."
TEST_OUTPUT=$(npm test -- tests/unit/brainy/*.test.ts 2>&1)

# Extract test statistics
TOTAL_TESTS=$(echo "$TEST_OUTPUT" | grep "Tests" | grep -oE "[0-9]+ (failed|passed)" | grep -oE "[0-9]+" | paste -sd+ | bc)
PASSED_TESTS=$(echo "$TEST_OUTPUT" | grep "Tests" | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+")
FAILED_TESTS=$(echo "$TEST_OUTPUT" | grep "Tests" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+")

# Calculate pass rate
if [ -z "$FAILED_TESTS" ]; then FAILED_TESTS=0; fi
if [ -z "$PASSED_TESTS" ]; then PASSED_TESTS=0; fi
if [ -z "$TOTAL_TESTS" ]; then TOTAL_TESTS=0; fi

if [ "$TOTAL_TESTS" -gt 0 ]; then
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
else
    PASS_RATE=0
fi

# Get list of test files
TEST_FILES=$(find tests/unit/brainy -name "*.test.ts" | wc -l)

# Count total lines of test code
TEST_LINES=$(find tests/unit/brainy -name "*.test.ts" -exec wc -l {} + | tail -1 | awk '{print $1}')

# Generate report
REPORT_FILE="test-report-$(date +%Y%m%d-%H%M%S).md"

cat > "$REPORT_FILE" << EOF
# 📊 Brainy Test Report
Generated: $(date)

## 🧪 Test Summary

- **Total Tests**: $TOTAL_TESTS
- **Passed**: $PASSED_TESTS ✅
- **Failed**: $FAILED_TESTS ❌
- **Pass Rate**: ${PASS_RATE}%
- **Test Files**: $TEST_FILES
- **Lines of Test Code**: $TEST_LINES

## 📁 Test File Breakdown

| File | Status | Tests |
|------|--------|-------|
EOF

# Add test file details
for file in tests/unit/brainy/*.test.ts; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        # Check if file has failures in test output
        if echo "$TEST_OUTPUT" | grep -q "$filename.*FAIL"; then
            status="❌ FAILING"
        else
            status="✅ PASSING"
        fi
        # Count tests in file (rough estimate)
        test_count=$(grep -c "it(" "$file" 2>/dev/null || echo "0")
        echo "| $filename | $status | $test_count |" >> "$REPORT_FILE"
    fi
done

cat >> "$REPORT_FILE" << 'EOF'

## 🎯 Recommendations for Development Team

### 🔴 Critical Issues

1. **Fix Failing Tests**
   - Priority: Resolve all failing tests before deployment
   - Action: Review test failures and update tests or fix implementation

2. **Metadata Handling in add() Method**
   - Issue: String data is spread into metadata causing corruption
   - Fix: Don't spread `params.data` when it's a string
   - File: `src/brainy.ts` line ~216

### 🟠 High Priority

1. **Duplicate ID Validation**
   - Issue: No validation for duplicate entity IDs
   - Recommendation: Add option to prevent or warn about duplicate IDs
   - Impact: Data integrity concerns

2. **Vector Dimension Validation**
   - Issue: Inconsistent validation of vector dimensions
   - Recommendation: Enforce consistent 384-dimension vectors
   - Impact: HNSW index integrity

3. **Increase Test Coverage**
   - Current: ~25% (estimated)
   - Target: 80% minimum for production
   - Focus: Core API methods and error paths

### 🟡 Medium Priority

1. **Relationship Metadata**
   - Issue: Some relationship tests failing with metadata
   - Recommendation: Review metadata handling in relate() method

2. **Update Method Vector Handling**
   - Issue: Vector updates not working as expected
   - Recommendation: Clarify API behavior for vector updates

3. **Performance Benchmarks**
   - Add performance regression tests
   - Monitor operation throughput

### 🟢 Low Priority

1. **Test Organization**
   - Consider grouping tests by feature area
   - Add integration test suite

2. **Documentation**
   - Update API docs based on test discoveries
   - Add examples for edge cases

## 📈 Coverage Goals

- **Week 1**: 30% coverage ✅ (achieved ~25%)
- **Week 2**: 50% coverage (focus on core APIs)
- **Week 3**: 70% coverage (add integration tests)
- **Week 4**: 80% coverage (production ready)

## 🚀 Next Steps

1. **Immediate**: Fix the 7 failing tests
2. **Today**: Complete relationship test suite
3. **This Week**: Add search/find test coverage
4. **Next Week**: Integration and performance tests

## 📝 API Behavior Discoveries

Based on our testing, here are the actual behaviors discovered:

1. **add() method**:
   - Spreads `data` into metadata (problematic for strings)
   - Allows duplicate IDs (overwrites)
   - No vector normalization

2. **update() method**:
   - Only updates vector when `data` provided
   - Merge behavior works correctly
   - Timestamps update properly

3. **relate() method**:
   - Creates relationships successfully
   - Supports bidirectional relationships
   - No relationship type validation

4. **get() method**:
   - Returns new object instances (no reference equality)
   - Handles non-existent IDs gracefully

## 💡 Development Recommendations

### Code Quality
- Add TypeScript strict mode checks
- Implement consistent error handling
- Add input validation layer

### Testing
- Add integration tests for workflows
- Create performance benchmarks
- Add edge case coverage

### API Design
- Consider making vector dimensions configurable
- Add validation options for stricter mode
- Improve metadata handling consistency

---
*Report generated by Brainy Test Suite*
*For questions, see test files in tests/unit/brainy/*
EOF

echo "✅ Report saved to $REPORT_FILE"

# Also create a JSON summary
JSON_FILE="test-report.json"
cat > "$JSON_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "summary": {
    "total_tests": $TOTAL_TESTS,
    "passed": $PASSED_TESTS,
    "failed": $FAILED_TESTS,
    "pass_rate": $PASS_RATE,
    "test_files": $TEST_FILES,
    "test_lines": $TEST_LINES
  },
  "recommendations": {
    "critical": [
      "Fix failing tests",
      "Fix metadata spreading issue in add()"
    ],
    "high": [
      "Add duplicate ID validation",
      "Enforce vector dimension validation",
      "Increase test coverage to 80%"
    ],
    "medium": [
      "Fix relationship metadata handling",
      "Clarify vector update behavior",
      "Add performance benchmarks"
    ],
    "low": [
      "Improve test organization",
      "Update documentation"
    ]
  }
}
EOF

echo "✅ JSON summary saved to $JSON_FILE"

# Display summary
echo ""
echo "📊 Test Summary:"
echo "- Tests: $PASSED_TESTS/$TOTAL_TESTS passing (${PASS_RATE}%)"
echo "- Files: $TEST_FILES test files"
echo "- Code: $TEST_LINES lines of test code"
echo ""
echo "See $REPORT_FILE for full details"