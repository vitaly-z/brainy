# Test Suite Cleanup Plan

## Tests to Remove (Redundant/Outdated)

### 1. Debug/Development Tests
- `metadata-filter-debug.test.ts` - Debug test, not needed in production
- `filter-discovery.test.ts` - Experimental/discovery test

### 2. Redundant Tests (Keep Best One)
- Keep `metadata-filter.test.ts`, remove `metadata-filter-environments.test.ts`
- Keep `s3-comprehensive.test.ts`, remove `s3-storage.test.ts`
- Keep `statistics.test.ts`, remove `statistics-storage.test.ts`
- Keep `performance.test.ts`, remove `performance-improvements.test.ts`
- Keep `storage-adapter-coverage.test.ts`, remove `storage-adapters.test.ts`

### 3. Outdated/Broken Tests
- `frozen-flag.test.ts` - Feature might be removed
- `distributed-config-migration.test.ts` - Old migration test
- `package-install.test.ts` - CI/CD concern, not unit test

## Tests to Fix

### 1. Missing destroy() method
- `regression.test.ts` - Remove destroy() calls or implement cleanup method

### 2. Update Expectations
- Storage tests expecting hard delete by default
- Statistics tests expecting exact counts

## Tests to Keep (Critical)
1. `core.test.ts` ✅
2. `unified-api.test.ts` ✅
3. `cli.test.ts` ✅
4. `vector-operations.test.ts`
5. `edge-cases.test.ts`
6. `error-handling.test.ts`
7. `environment.*.test.ts`
8. `opfs-storage.test.ts`
9. `brainy-chat.test.ts`
10. `intelligent-verb-scoring.test.ts`

## Expected Result
- Remove ~15 redundant/outdated tests
- Fix ~5 tests with wrong expectations
- Final count: ~400-450 meaningful tests instead of 600+