# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [3.15.0](https://github.com/soulcraftlabs/brainy/compare/v3.14.2...v3.15.0) (2025-09-26)

### Bug Fixes

* **vfs**: Ensure Contains relationships are maintained when updating files
* **vfs**: Fix root directory metadata handling to prevent "Not a directory" errors
* **vfs**: Add entity metadata compatibility layer for proper VFS operations
* **vfs**: Fix resolvePath() to return entity IDs instead of path strings
* **vfs**: Improve error handling in ensureDirectory() method

### Features

* **vfs**: Add comprehensive tests for Contains relationship integrity
* **vfs**: Ensure all VFS entities use standard Brainy NounType and VerbType enums
* **vfs**: Add metadata validation and repair for existing entities

## [3.0.1](https://github.com/soulcraftlabs/brainy/compare/v2.14.3...v3.0.1) (2025-09-15)

**Brainy 3.0 Production Release** - World's first Triple Intelligence™ database unifying vector, graph, and document search

### Features

* **new api**: Complete API redesign with add(), find(), update(), delete(), relate() methods
* **triple intelligence**: Unified vector, graph, and document search in one API
* **comprehensive validation**: Zero-config validation system with production-ready type safety
* **neural clustering**: Advanced clustering with clusterFast(), clusterLarge(), and hierarchical algorithms
* **augmentation system**: Built-in cache, display, and metrics augmentations
* **extensive testing**: 100+ comprehensive tests covering all APIs and edge cases

### BREAKING CHANGES

* All previous APIs (addNoun, findNoun, etc.) have been replaced with new 3.0 APIs
* See README.md for complete migration guide from 2.x to 3.0

## [2.14.0](https://github.com/soulcraftlabs/brainy/compare/v2.13.0...v2.14.0) (2025-09-02)


### Features

* implement clean embedding architecture with Q8/FP32 precision control ([b55c454](https://github.com/soulcraftlabs/brainy/commit/b55c454))

## [2.13.0](https://github.com/soulcraftlabs/brainy/compare/v2.12.0...v2.13.0) (2025-09-02)


### Features

* implement comprehensive neural clustering system ([7345e53](https://github.com/soulcraftlabs/brainy/commit/7345e53))
* implement comprehensive type safety system with BrainyTypes API ([0f4ab52](https://github.com/soulcraftlabs/brainy/commit/0f4ab52))

## [2.10.0](https://github.com/soulcraftlabs/brainy/compare/v2.9.0...v2.10.0) (2025-08-29)

## [2.8.0](https://github.com/soulcraftlabs/brainy/compare/v2.7.4...v2.8.0) (2025-08-29)

## [2.7.4] - 2025-08-29

### Fixed
- Use fp32 models consistently everywhere to ensure compatibility
- Changed default dtype from q8 to fp32 across all embedding implementations
- Ensures the exact same model (model.onnx) is used everywhere
- Prevents 404 errors when looking for quantized models that don't exist on CDN
- Maintains data compatibility across all Brainy instances

## [2.7.3] - 2025-08-29

### Fixed
- Allow automatic model downloads without requiring BRAINY_ALLOW_REMOTE_MODELS environment variable
- Models now download automatically when not present locally
- Fixed environment variable check to only block downloads when explicitly set to 'false'

## [2.0.0] - 2025-08-26

### 🎉 Major Release - Triple Intelligence™ Engine

This release represents a complete evolution of Brainy with groundbreaking features and performance improvements.

### Added
- **Triple Intelligence™ Engine**: Unified Vector + Metadata + Graph search in one API
- **Natural Language Processing**: 220+ pre-computed NLP patterns for instant understanding
- **Universal Memory Manager**: Worker-based embeddings with automatic memory management
- **Zero Configuration**: Everything works instantly with no setup required
- **Brain Cloud Integration**: Connect to soulcraft.com for team sync and persistent memory
- **Augmentation System**: 19 production-ready augmentations for extended capabilities
- **CLI Enhancements**: Complete command-line interface with all API methods
- **New `find()` API**: Natural language queries with context understanding
- **OPFS Storage**: Browser-native storage support
- **S3 Storage**: Production-ready cloud storage adapter
- **Graph Relationships**: Navigate connected knowledge with `addVerb()`
- **Cursor Pagination**: Efficient handling of large result sets
- **Automatic Caching**: Intelligent result and embedding caching

### Changed
- **API Consolidation**: 15+ search methods → 2 clean APIs (`search()` and `find()`)
- **Search Signature**: From `search(query, limit, options)` to `search(query, options)`
- **Result Format**: Now returns full objects with id, score, content, and metadata
- **Storage Configuration**: Moved under `storage` option with type-specific settings
- **Performance**: O(log n) metadata filtering with binary search
- **Memory Usage**: Reduced from 200MB to 24MB baseline
- **Search Latency**: Improved from 50ms to 3ms average

### Fixed
- Circular dependency in Triple Intelligence system
- Memory leaks in embedding generation
- Worker thread communication timeouts
- Metadata index performance bottlenecks
- TypeScript compilation errors (153 → 0)
- Storage adapter consistency issues

### Deprecated
- Individual search methods (`searchByVector`, `searchByNounTypes`, etc.)
- Three-parameter search signature
- Direct storage type configuration

### Removed
- Legacy delegation pattern
- Redundant search method implementations
- Unused dependencies

### Security
- Improved input sanitization
- Safe metadata filtering
- Secure storage adapter implementations

---

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2024-08-22

### 🚀 Major Features

#### Triple Intelligence Engine
- **NEW**: Unified query system combining vector similarity, graph relationships, and field filtering
- **NEW**: Cross-intelligence optimization - queries automatically use the most efficient combination
- **NEW**: Natural language query processing with intent recognition

#### Advanced Indexing Systems
- **NEW**: HNSW indexing for sub-millisecond vector search
- **NEW**: Field indexing with O(1) metadata lookups
- **NEW**: Graph pathfinding with multiple algorithms (Dijkstra, PageRank, BFS/DFS)
- **NEW**: Metadata index manager for intelligent query optimization

#### Storage & Performance
- **NEW**: Universal storage adapters (FileSystem, S3, OPFS, Memory)
- **NEW**: Smart caching with LRU and intelligent cache invalidation  
- **NEW**: Streaming data processing for large datasets
- **NEW**: Write-Ahead Logging (WAL) for data integrity

#### Developer Experience
- **NEW**: Comprehensive CLI with interactive mode
- **NEW**: Brain Patterns Query Language (MongoDB-compatible syntax)
- **NEW**: 220 embedded natural language patterns for query understanding
- **NEW**: Full TypeScript support with advanced type definitions

### 🔧 API Changes

#### Breaking Changes
- **CHANGED**: `search()` now returns `{id, score, content, metadata}` objects instead of arrays
- **CHANGED**: Storage configuration moved to `storage` option in constructor
- **CHANGED**: Vector search results include similarity scores as objects
- **CHANGED**: Metadata filtering uses new optimized field indexes

#### New APIs
- **ADDED**: `brain.find()` - MongoDB-style queries with semantic extensions
- **ADDED**: `brain.cluster()` - Semantic clustering functionality
- **ADDED**: `brain.findRelated()` - Relationship discovery and traversal
- **ADDED**: `brain.statistics()` - Performance and usage analytics

### 🏗️ Architecture

#### Core Systems
- **NEW**: Triple Intelligence architecture unifying three search paradigms
- **NEW**: Augmentation system for extensible functionality
- **NEW**: Entity registry for intelligent data deduplication
- **NEW**: Pipeline processing for complex data transformations

#### Performance Optimizations
- **IMPROVED**: 10x faster metadata filtering using specialized indexes
- **IMPROVED**: Memory usage optimization with embedded patterns
- **IMPROVED**: Query optimization with smart execution planning
- **IMPROVED**: Batch processing for high-throughput scenarios

### 📚 Documentation & Testing
- **NEW**: Comprehensive test suite with 50+ tests covering all features
- **NEW**: Professional documentation with clear examples
- **NEW**: Migration guide for 1.x users
- **NEW**: API reference with TypeScript signatures

### 🐛 Bug Fixes
- **FIXED**: Memory leaks in pattern matching system
- **FIXED**: Vector dimension mismatches in multi-model scenarios  
- **FIXED**: Infinite recursion in graph traversal edge cases
- **FIXED**: Race conditions in concurrent access scenarios
- **FIXED**: Edge cases in field filtering with complex nested queries

### 💔 Removed
- **REMOVED**: Legacy query history (replaced with LRU cache)
- **REMOVED**: Deprecated 1.x storage format (auto-migration provided)
- **REMOVED**: Debug logging in production builds

---

## [1.6.0] - 2024-08-15

### Added
- Enhanced vector operations with better similarity scoring
- Improved metadata filtering capabilities
- Basic graph relationship support
- CLI improvements for better user experience

### Fixed
- Vector search accuracy improvements
- Storage stability enhancements
- Memory usage optimizations

---

## [1.5.0] - 2024-07-20

### Added
- OPFS (Origin Private File System) support for browsers
- Enhanced TypeScript definitions
- Better error handling and reporting

### Changed
- Improved API consistency across storage adapters
- Enhanced test coverage

---

## [1.0.0] - 2024-06-01

### Added
- Initial stable release
- Core vector database functionality
- File system storage adapter
- Basic CLI interface
- TypeScript support

---

## Migration Guides

### Migrating from 1.x to 2.0

See [MIGRATION.md](MIGRATION.md) for detailed migration instructions including:
- API changes and new patterns
- Storage format updates
- Configuration changes
- New features and capabilities