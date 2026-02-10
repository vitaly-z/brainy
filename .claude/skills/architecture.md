# Brainy Architecture Reference

## What Is Brainy

@soulcraft/brainy (v7.17.0) is a Universal Knowledge Protocol -- a Triple Intelligence database combining vector search, graph traversal, and metadata filtering in a single library. Published to npm as a public MIT-licensed package.

## Core Architecture

### Storage Layer (`src/storage/`)
- **StorageAdapter interface** (`src/coreTypes.ts:576`): The contract ALL storage backends implement. ALWAYS check this interface before adding storage methods.
- **BaseStorage** (`src/storage/baseStorage.ts`): Base implementation with built-in type-aware partitioning (TypeAwareStorageAdapter was removed -- functionality merged into BaseStorage).
- **Adapters** (`src/storage/adapters/`):
  - `fileSystemStorage.ts` -- local filesystem
  - `opfsStorage.ts` -- browser Origin Private File System (formerly browserStorage.ts)
  - `memoryStorage.ts` -- in-memory
  - `s3CompatibleStorage.ts` -- generic S3-compatible (AWS, MinIO, etc.)
  - `r2Storage.ts` -- Cloudflare R2
  - `gcsStorage.ts` -- Google Cloud Storage
  - `azureBlobStorage.ts` -- Azure Blob Storage
  - Supporting: `batchS3Operations.ts`, `optimizedS3Search.ts`
- **COW** (`src/storage/cow/`): Copy-on-Write infrastructure for versioning and branching
  - CommitLog, CommitObject, CommitBuilder, BlobStorage, RefManager, TreeObject

### Vector Search (`src/hnsw/`)
- `hnswIndex.ts` -- HNSW-based approximate nearest neighbor search
- `typeAwareHNSWIndex.ts` -- type-partitioned vector search
- NOT in `src/intelligence/` (that directory does not exist)

### Graph Engine (`src/graph/`)
- `graphAdjacencyIndex.ts` -- adjacency-based graph representation
- `pathfinding.ts` -- relationship traversal and pathfinding
- `lsm/` -- LSM tree implementation for graph storage

### Metadata Index (`src/utils/metadataIndex.ts`)
- O(1) exact match via hash indexes
- O(log n) range queries via sorted indexes
- Roaring bitmap set operations for efficient filtering
- Adaptive chunking strategy (`metadataIndexChunking.ts`)
- Caching layer (`metadataIndexCache.ts`)

### Triple Intelligence (`src/triple/`)
- `TripleIntelligenceSystem.ts` -- combines vector + graph + metadata into unified queries
- Lazy-loaded indexes (loaded on first use, not at startup)

### Neural/AI Components (`src/neural/`)
- Smart Importers (`src/importers/`): CSV, Excel, PDF, DOCX, YAML, JSON, Markdown, Orchestrator
- `SmartExtractor.ts` -- entity extraction from unstructured data
- `SmartRelationshipExtractor.ts` -- relationship detection
- `NeuralEntityExtractor.ts` -- ML-based entity recognition
- Natural language processing utilities

### Distributed Systems (`src/distributed/`)
- Distributed Coordinator for multi-node operation
- Shard Manager for data partitioning
- Cache Synchronization across nodes
- Read/Write separation
- Network and HTTP transport layers
- Storage discovery and shard migration

### Transaction Management (`src/transaction/`)
- TransactionManager for ACID operations
- Operations: SaveNoun, AddToHNSW, UpdateMetadata, etc.
- Distributed transaction support

### Integration Hub (`src/integrations/`)
- Google Sheets integration
- OData (Open Data Protocol)
- Server-Sent Events (SSE)
- Webhooks
- Event bus system

### Virtual Filesystem (`src/vfs/`)
- `VirtualFileSystem.ts` -- full VFS implementation (87 KB)
- `PathResolver.ts`, `FSCompat.ts`, `MimeTypeDetector.ts`, `TreeUtils.ts`
- Subdirectories: `semantic/` (semantic search), `streams/` (streaming), `importers/`

### MCP Support (`src/mcp/`)
- BrainyMCPAdapter, MCPAugmentationToolset, BrainyMCPService
- Model Control Protocol request/response handling

### Additional Systems
- **CLI** (`src/cli/`): Complete command-line tool with interactive mode and catalog system
- **Migration** (`src/migration/`): MigrationRunner for database schema migrations
- **Embeddings** (`src/embeddings/`): Embedding manager with Candle-WASM Rust source
- **Streaming** (`src/streaming/`): Pipeline support with adaptive backpressure
- **Versioning** (`src/versioning/`): VersioningAPI for data versioning
- **Plugin System**: Registry-based plugin architecture
- **Patterns** (`src/patterns/`): 7 pattern library JSON files

## Type System
- **NounType** (42 types, `src/types/graphTypes.ts:850-893`): Person, Organization, Concept, Collection, Document, Task, Project, etc.
- **VerbType** (127 types, `src/types/graphTypes.ts:900-1087`): Contains, RelatedTo, PartOf, Creates, DependsOn, MemberOf, etc.
- All types in `src/types/`

## Module Exports (`src/index.ts`)
38+ named exports including: Brainy class, configuration types, neural APIs (NeuralImport, NeuralEntityExtractor, SmartExtractor, SmartRelationshipExtractor), distance functions, plugin system, migration system, embedding functions, storage adapters, COW infrastructure, pipeline utilities, graph types, MCP components, integration hub, OData utilities, and more.

## File Structure
```
src/
├── index.ts              # 38+ public exports
├── brainy.ts             # Main Brainy class (6,500+ lines)
├── setup.ts              # Initialization polyfills
├── coreTypes.ts          # StorageAdapter interface + core types
├── storage/
│   ├── baseStorage.ts    # Base storage (includes type-aware)
│   ├── adapters/         # All storage backends + cloud adapters
│   └── cow/              # Copy-on-Write versioning
├── hnsw/                 # HNSW vector search
├── graph/                # Graph engine + pathfinding + LSM
├── triple/               # Triple Intelligence system
├── neural/               # Smart extractors + NLP
├── importers/            # File format importers (8 types)
├── distributed/          # Distributed database (16 files)
├── transaction/          # ACID transactions (6 files)
├── integrations/         # Sheets, OData, SSE, Webhooks
├── vfs/                  # Virtual filesystem + semantic search
├── mcp/                  # Model Control Protocol
├── cli/                  # Command-line interface
├── migration/            # Schema migrations
├── embeddings/           # Embedding manager + Candle-WASM
├── streaming/            # Pipeline + backpressure
├── versioning/           # Versioning API
├── types/                # TypeScript type definitions
├── utils/                # Metadata index, logging, etc.
├── config/               # Configuration system
├── patterns/             # Pattern library
├── api/                  # API layer
├── interfaces/           # Interface definitions
├── shared/               # Shared utilities
├── data/                 # Data utilities
├── errors/               # Error handling
├── critical/             # Critical error handling
├── universal/            # Universal utilities
├── import/               # Import functionality
└── scripts/              # Build scripts
```

## Initialization
`brainy.ts` `init()` method performs initialization cascade:
1. Load plugins
2. Initialize storage
3. Enable COW (Copy-on-Write)
4. Set up embeddings
5. Initialize caches
6. Set up graph indexes
7. Initialize VFS
8. Set up transaction manager
9. Initialize distributed components (if enabled)

## Testing
- Framework: Vitest
- Run: `npm test`
- Test directories:
  - `tests/unit/` -- unit tests
  - `tests/integration/` -- integration tests
  - `tests/benchmarks/` -- performance benchmarks (NOT tests/performance/)
  - `tests/comprehensive/` -- comprehensive test suites
  - `tests/api/` -- API tests
  - `tests/helpers/` -- test utilities

## Release
- `npm run release:patch/minor/major` -- fully automated via `scripts/release.sh`
- `npm run release:dry` -- preview without changes
- Uses conventional commits for changelog generation
