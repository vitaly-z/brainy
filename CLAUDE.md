# Brainy - Claude Code Project Guide

This file provides guidance for Claude Code (and human contributors) when working on the Brainy codebase.

## Project Overview

Brainy is a Universal Knowledge Protocol -- a Triple Intelligence database that combines vector similarity search, graph traversal, and metadata filtering into a single TypeScript library. Published as `@soulcraft/brainy` on npm under the MIT license.

## Getting Started

```bash
npm install           # Install dependencies
npm run build         # Build the project
npm test              # Run test suite (Vitest)
```

## Architecture

Full architecture reference: `.claude/skills/architecture.md`

### Core Systems
- **Storage** (`src/storage/`): Pluggable storage backends via StorageAdapter interface (`src/coreTypes.ts`)
- **Vector Search** (`src/hnsw/`): HNSW approximate nearest neighbor search
- **Graph Engine** (`src/graph/`): Relationship traversal with adjacency index and pathfinding
- **Metadata Index** (`src/utils/metadataIndex.ts`): O(1) exact match, O(log n) range queries
- **Triple Intelligence** (`src/triple/`): Unified query combining all three intelligence types
- **Virtual Filesystem** (`src/vfs/`): Full VFS with semantic search

### Type System
- **NounType** (42 types): Entity classification -- Person, Concept, Collection, Document, Task, etc.
- **VerbType** (127 types): Relationship types -- Contains, RelatedTo, PartOf, Creates, DependsOn, etc.
- Defined in `src/types/graphTypes.ts`

## Code Standards

### TypeScript
- Strict mode enabled
- Target: ES2020, NodeNext module resolution
- All new code must be TypeScript
- Follow existing patterns -- read related code before writing

### Quality
- All code must compile without errors
- All code must have working tests that exercise real behavior
- No stub returns (`return {} as any`)
- No incomplete implementations with TODO comments
- If something can't be fully implemented, throw an explicit error rather than faking it

### Verification Before Code Changes
1. Check that interfaces and methods actually exist before using them
2. Check that type properties are in the type definitions
3. Run `npm test` -- tests must pass
4. Run `npm run build` -- build must succeed

### Testing
- Framework: Vitest
- Tests in `tests/` (unit, integration, benchmarks, comprehensive)
- Use in-memory storage for speed where possible
- Tests must exercise real behavior, not mock it
- Benchmarks are in `tests/benchmarks/` (not tests/performance/)

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature        (minor version bump)
fix: resolve bug             (patch version bump)
docs: update documentation   (patch version bump)
perf: improve performance    (patch version bump)
refactor: restructure code   (patch version bump)
test: add/update tests       (patch version bump)
```

**Important:** Never use `BREAKING CHANGE` in commit messages. Major version bumps are manual decisions only (`npm run release:major`).

## Release Process

Fully automated via `scripts/release.sh`:

```bash
npm run release:dry          # Preview (no changes)
npm run release:patch        # Bug fixes
npm run release:minor        # New features
npm run release:major        # Breaking changes (rare, manual decision)
```

The script: verifies clean git state, builds, tests, bumps version, updates CHANGELOG.md, commits, tags, pushes, publishes to npm, and creates a GitHub release.

## Performance Claims

When documenting performance characteristics:
- **MEASURED**: Cite the test file and line number
- **PROJECTED**: Clearly label as extrapolated from tested scale
- Never claim a performance figure without context or evidence

## Debugging

When a bug persists through 2+ fix attempts, switch to systematic debugging:
1. Add comprehensive logging at every step
2. Test with production-like data
3. Trace the complete execution path
4. Check both library code and consumer code
5. Verify with actual test execution before declaring fixed

## Key Paths

- Main class: `src/brainy.ts`
- Public API: `src/index.ts` (38+ exports)
- Storage interface: `src/coreTypes.ts`
- Type definitions: `src/types/`
- Strategy/planning docs: `.strategy/` (gitignored, not public)
