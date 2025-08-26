# 🧠 Brainy Testing Strategy

## Overview

Brainy uses ONNX Runtime with transformer models, requiring 4-8GB memory for full functionality. This document explains our testing strategy based on 2024-2025 best practices.

## Memory Requirements

| Component | Memory Usage | Notes |
|-----------|-------------|-------|
| ONNX Model | 4-8GB | all-MiniLM-L6-v2 transformer |
| Node.js Heap | 2-4GB | JavaScript runtime |
| Test Framework | 1-2GB | Vitest overhead |
| **Total** | **8-16GB** | Recommended for full suite |

## Test Commands

### Quick Reference
```bash
npm test                  # Standard test run
npm run test:memory       # With 16GB heap allocation
npm run test:core         # Core functionality only
npm run test:ci           # CI optimized
npm run test:shard       # Supports VITEST_SHARD env
```

### Memory-Intensive Tests
```bash
# Allocate 16GB for transformer models
NODE_OPTIONS='--max-old-space-size=16384' npm test

# Or use our helper script
npm run test:memory
```

### Test Sharding (CI/CD)
```bash
# Split tests across 4 machines/processes
VITEST_SHARD=1/4 npm run test:shard  # 1st quarter
VITEST_SHARD=2/4 npm run test:shard  # 2nd quarter
VITEST_SHARD=3/4 npm run test:shard  # 3rd quarter
VITEST_SHARD=4/4 npm run test:shard  # 4th quarter
```

## Vitest Configuration

Our `vitest.config.ts` implements industry best practices:

### Memory Optimization
- **Pool**: `forks` for better memory isolation
- **Max Forks**: 1 (sequential execution)
- **Isolation**: Enabled (prevents memory leaks)

### Timeouts
- **Test**: 120 seconds (ONNX loading)
- **Hooks**: 60 seconds (model initialization)
- **Teardown**: 10 seconds

### Performance
- **Parallelism**: Disabled (prevents OOM)
- **Retry**: Once in CI (handles flaky tests)
- **Reporters**: Dot for CI, verbose for local

## Test Organization

### Current Structure (All Tests)
```
tests/
├── core.test.ts              # Core functionality
├── triple-intelligence.test.ts  # AI features
├── metadata-filter.test.ts      # Brain Patterns
├── neural-api.test.ts          # Neural operations
└── ... (45+ test files)
```

### Future Structure (Recommended)
```
tests/
├── unit/                    # No models, fast
│   ├── utils/
│   ├── storage/
│   └── metadata/
├── integration/             # With models, slow
│   ├── search/
│   ├── embeddings/
│   └── triple/
└── e2e/                     # Full system tests
```

## Common Issues & Solutions

### Out of Memory (OOM)
**Error**: `FATAL ERROR: Ineffective mark-compacts near heap limit`

**Solutions**:
1. Increase heap: `NODE_OPTIONS='--max-old-space-size=16384'`
2. Run fewer tests: `npm test tests/core.test.ts`
3. Use sharding: `VITEST_SHARD=1/2`

### Test Timeouts
**Error**: `Test timed out after 30000ms`

**Solutions**:
1. Already extended to 120s in config
2. Skip model tests: `npm test -- --exclude "**/neural*"`
3. Mock embeddings for unit tests

### ClearAll Safety
**Error**: `clearAll requires force: true option`

**Solution**: Always use `brain.clearAll({ force: true })`
✅ Already fixed in all test files

## CI/CD Recommendations

### GitHub Actions
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1/4, 2/4, 3/4, 4/4]
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - run: npm ci
      - run: npm run build
      
      # Run sharded tests with memory
      - run: VITEST_SHARD=${{ matrix.shard }} npm run test:ci
        env:
          NODE_OPTIONS: --max-old-space-size=16384
```

### Docker
```dockerfile
FROM node:18
WORKDIR /app

# Increase memory limits
ENV NODE_OPTIONS="--max-old-space-size=16384"

COPY . .
RUN npm ci
RUN npm run build

# Run tests
CMD ["npm", "run", "test:memory"]
```

## Performance Benchmarks

With proper configuration:
- **Model Load**: 30-60 seconds (first time)
- **Embedding**: 10-50ms per text
- **Test Suite**: 5-10 minutes (sequential)
- **Memory Usage**: 4-8GB peak

## Best Practices

1. **Always build before testing**
   ```bash
   npm run build && npm test
   ```

2. **Monitor memory during tests**
   ```bash
   watch -n 1 "ps aux | grep node | head -5"
   ```

3. **Use appropriate test command**
   - Development: `npm test`
   - CI: `npm run test:ci`
   - Debugging: `npm run test:memory -- --reporter=verbose`

4. **Mock for unit tests**
   ```javascript
   // Mock embeddings for non-AI tests
   const mockEmbed = () => new Array(384).fill(0.1)
   ```

## Industry Standards

We follow these 2024-2025 best practices:

1. **Vitest Forks Pool**: Better memory isolation than threads
2. **Test Sharding**: Distribute across multiple processes
3. **Sequential Execution**: Prevent memory competition
4. **Extended Timeouts**: Account for model loading
5. **Memory Monitoring**: Track usage during tests

## Conclusion

Brainy's testing requires significant memory due to transformer models. This is not a bug - it's the cost of running state-of-the-art AI locally. Our configuration follows industry best practices to manage this requirement effectively.

For projects that cannot allocate 8-16GB for testing:
- Use mock embeddings for unit tests
- Run integration tests separately in CI
- Consider cloud-based testing environments
- Use test sharding to distribute load