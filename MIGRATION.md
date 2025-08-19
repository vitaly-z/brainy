# Migration Guide: Brainy 0.x → 1.0

## Breaking Changes

### 1. Soft Delete by Default
- `delete()` now performs soft delete by default
- Items are marked with `deleted: true` metadata instead of being removed
- To perform hard delete: `delete(id, { soft: false })`

### 2. Enhanced Search Filtering
- Soft deleted items are automatically excluded from search results
- No code changes needed - this happens automatically

### 3. Configuration Storage
- New encrypted configuration storage API
- Use `setConfig()` and `getConfig()` for secure configuration

## New Features

### 1. Unified API
- 5 core methods for all operations
- `add()`, `search()`, `import()`, `addNoun()`, `addVerb()`

### 2. Encryption Support
- Built-in encryption for sensitive data
- `encryptData()` and `decryptData()` methods

### 3. Augmentation System
- Professional augmentation catalog
- Registry integration at registry.soulcraft.com

## Upgrade Steps

1. Update package: `npm install @soulcraft/brainy@latest`
2. Review delete operations if expecting hard delete
3. Update tests to expect soft delete behavior
4. Leverage new encryption features for sensitive data