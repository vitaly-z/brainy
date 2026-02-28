# Brainy - Claude Code Project Guide

This file provides guidance for Claude Code (and human contributors) when working on the Brainy codebase.

## Cross-Project Coordination

Handoff file: `/home/dpsifr/.strategy/PLATFORM-HANDOFF.md`

**At session START:** Read the handoff. Find rows where Owner = Brainy. Act on those first.

**At session END:** Mark completed actions ✅, delete rows you finished, delete threads with zero remaining actions. File must not grow. **If you shipped anything consumers need to know about, update `RELEASES.md` before closing.**

**Brainy's current open actions:** None. MIT open-source — no platform-specific actions.

**Current version:** `@soulcraft/brainy@7.19.10`

---

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
- **Aggregation Engine** (`src/aggregation/`): Write-time incremental SUM/COUNT/AVG/MIN/MAX with GROUP BY and time windows
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

## Docs Pipeline — soulcraft.com/docs

Docs in `docs/**/*.md` are published with the npm package (included in `files`) and synced to soulcraft.com/docs on every portal deploy. Frontmatter controls what appears publicly.

### Docs check triggers

Run the docs check whenever the user says ANY of:
- "commit, publish, release" / "release" / "publish"
- "update the docs" / "make sure docs are accurate" / "check the docs"
- "review docs" / "clean up docs"

### Pre-release docs check (MANDATORY before every release)

When the user says "commit, publish, release" or any variation, **before committing**:

1. **Scan all files changed in this session** (and any recently added `docs/*.md` files)
2. For each changed/new doc, decide: is this useful to external users?
   - **Yes** → ensure it has complete frontmatter (add or update it)
   - **No** (internal, migration, dev-only) → ensure it has no frontmatter or `public: false`
3. For docs that already have frontmatter, verify:
   - `description` still matches the actual content
   - `next` links still exist and are still the right follow-up pages
   - `title` matches the doc's h1
4. Include frontmatter changes in the commit

### Frontmatter format

```yaml
---
title: Human-readable title
slug: category/page-name          # URL: soulcraft.com/docs/category/page-name
public: true                      # false or absent = not published
category: getting-started | concepts | guides | api
template: guide | concept | api   # controls layout on soulcraft.com
order: 1                          # sidebar position within category (lower = first)
description: One sentence. What this doc covers and why it matters.
next:                             # "Next steps" links shown at bottom of page
  - category/other-slug
---
```

### Category guide

| category | use for |
|----------|---------|
| `getting-started` | installation, quick start, first steps |
| `concepts` | how the system works, mental models |
| `guides` | how to do specific things, recipes |
| `api` | method reference, signatures, parameters |

### What stays internal (no frontmatter / `public: false`)

- Release guides, developer learning paths
- Migration guides for old versions (v3→v4, v5.11)
- Architecture analysis docs (clustering algorithms, etc.)
- Anything in `docs/internal/`
- Deployment/ops/cost docs (cloud-run, kubernetes, cost-optimization)

## Release Process

Fully automated via `scripts/release.sh`:

```bash
npm run release:dry          # Preview (no changes)
npm run release:patch        # Bug fixes
npm run release:minor        # New features
npm run release:major        # Breaking changes (rare, manual decision)
```

The script: verifies clean git state, builds, tests, bumps version, updates CHANGELOG.md, commits, tags, pushes, publishes to npm, and creates a GitHub release.

After a successful release, remind the user:
> "Published. Deploy portal to pick up the new docs → go to the portal project and deploy."

Do NOT deploy portal from here. Portal is always deployed separately from within the portal project.

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
