# Changelog

All notable changes to Brainy will be documented in this file.

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