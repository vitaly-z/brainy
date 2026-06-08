---
title: Query Limits & Pagination
slug: guides/find-limits
public: true
category: guides
template: guide
order: 8
description: How Brainy caps `find({ limit })` to prevent OOM, the three escape valves when the cap is too tight, and why pagination is the future-proof pattern.
next:
  - guides/aggregation
  - api/reference
---

# Query Limits & Pagination

Brainy's `find()` returns entities into a JavaScript array. The size of that array is bounded by an auto-configured cap so a single query can never run the host out of memory. This guide explains the cap, the three ways to raise it when your use case justifies it, and the one pattern that scales no matter what cap is in effect: pagination.

## Why the cap exists

Every entity Brainy returns carries:

- A 384-dim float32 embedding vector (1.5 KB)
- Standard fields: `id`, `type`, `subtype`, timestamps, confidence, weight (~200 bytes)
- User metadata (variable — typical 5-10 KB, can spike to 20+ KB)

Conservative budget: **25 KB per result**. A `find({ limit: 100_000 })` against a brain with rich metadata can claim ~2.5 GB before Brainy's iteration starts. JavaScript's GC + V8's heap targets can't absorb that swing without paging or OOM in production.

The cap is a safety net. It's not the only reason your query might be slow — graph traversal and HNSW search have their own perf characteristics — but it's the one that turns a slow query into a sudden runtime error.

## The auto-configured cap (7.30.2+)

Brainy picks `maxLimit` from the first of these that's available:

| Priority | Source | Formula |
|---|---|---|
| 1 | Constructor option `maxQueryLimit` | Hard cap at supplied value, max 100 000 |
| 2 | Constructor option `reservedQueryMemory` | `floor(reservedQueryMemory / 25 KB)` capped at 100 000 |
| 3 | Detected container memory limit (Cloud Run, Kubernetes, cgroups v1/v2) | `floor(containerLimit × 0.25 / 25 KB)` capped at 100 000 |
| 4 | Free system memory | `floor(availableMemory / 25 KB)` capped at 100 000 |

Worked example: a 4 GB Cloud Run container picks priority 3 → `floor(4 GB × 0.25 / 25 KB) = floor(40 960) = 40 000` results. A 900 MB free-memory box on priority 4 gets `floor(900 MB / 25 KB) = ~36 000`.

> **Calibration note.** Pre-7.30.2 used 100 KB per result instead of 25 KB, which produced caps that were 4× too tight for typical workloads (an 8 KB / result reality). 7.30.2 recalibrated to match observed entity sizes; existing `limit: 10_000` safety patterns now pass silently on any reasonably-sized box.

## What happens when you exceed the cap

`find({ limit })` enforces in **two tiers**:

### Soft tier: `maxLimit < limit ≤ 2 × maxLimit`

You get a one-time warning per call site:

```
[Brainy] find({ limit: 50000 }) exceeds the auto-configured query limit of
40000 (basis: detected container memory limit). Choose one:
  • Increase the cap: new Brainy({ maxQueryLimit: 50000 })
  • Reserve more memory: new Brainy({ reservedQueryMemory: 1310720000 })
  • Paginate: split the query with { limit, offset } pages
  at YourService.loadDashboard (/app/src/dashboard.ts:142:18)
Docs: https://soulcraft.com/docs/guides/find-limits
```

**The query proceeds.** Brainy returns the result set you asked for; the warning is a teaching signal, not a block. Existing code that relied on the cap silently allowing safety-cap limits (`limit: 10_000` against a 9 K-cap box) keeps working — the warning shows you the recipe so you can fix it intentionally.

### Hard tier: `limit > 2 × maxLimit`

Same message, but thrown as an error. This is real OOM territory; the cap stops being a recommendation and becomes a guardrail.

## The three escape valves

### 1. Raise the cap at construction — `maxQueryLimit`

When the auto-config is wrong for your workload (e.g. you know your entities are smaller than 25 KB average and you need bigger result sets), set an explicit cap:

```typescript
const brain = new Brainy({
  storage: { type: 'filesystem', options: { path: './data' } },
  maxQueryLimit: 50_000   // raises the cap; still hard-clamped at 100 000
})
```

This is the right answer when:
- Your entity metadata is genuinely small (e.g. 1-2 KB) and 25 KB per result is over-conservative
- You're running on a box with lots of headroom and 25% of memory underestimates what you can spare for queries
- You need a known-good limit that doesn't change when the box's free-memory wiggles at startup

### 2. Reserve more memory for queries — `reservedQueryMemory`

When you want the cap to be memory-derived but more generous than the default 25% slice:

```typescript
const brain = new Brainy({
  reservedQueryMemory: 1024 * 1024 * 1024  // 1 GB → ~40 000 result cap
})
```

This is the right answer when:
- Your host's memory budget for queries is known and stable, regardless of free-memory at startup
- You want the formula to scale with the documented per-result size (25 KB) instead of a hard number

### 3. Paginate — the future-proof pattern

If your query genuinely needs to walk all matches in a category, don't fight the cap — walk in pages:

```typescript
async function findAll<T>(params: FindParams<T>, pageSize = 1000): Promise<Result<T>[]> {
  const all: Result<T>[] = []
  let offset = 0
  while (true) {
    const page = await brain.find({ ...params, limit: pageSize, offset })
    all.push(...page)
    if (page.length < pageSize) break
    offset += page.length
  }
  return all
}

// Use it just like find():
const allEvents = await findAll({ type: NounType.Event, where: { status: 'open' } })
```

For very large brains, prefer the streaming API which avoids holding the full result set in memory at all:

```typescript
for await (const entity of brain.streaming.entities({ type: NounType.Event })) {
  // process one entity at a time
}
```

## When to use which

| Situation | Recommended valve |
|---|---|
| The cap is unreasonably low for your known entity size | `maxQueryLimit` |
| You want a memory-derived cap but more generous than 25% | `reservedQueryMemory` |
| Your query needs ALL matches in a category | Pagination or `brain.streaming.entities()` |
| You hit the cap once during a one-off migration | `maxQueryLimit` or `migrateField` (which already paginates internally) |
| You're hitting the cap on a recurring user-facing query | Pagination — the cap will get tighter in 8.0, not looser |

## A note on Brainy 8.0

8.0's Datomic-style `Db` API may make per-call limits stricter to keep snapshot semantics cheap. **Pagination is the only pattern that's guaranteed to keep working unchanged.** Code that paginates today doesn't need to revisit when 8.0 ships.

## Reference

- `BrainyConfig.maxQueryLimit?: number` — explicit cap override (max 100 000)
- `BrainyConfig.reservedQueryMemory?: number` — memory budget for queries (bytes)
- `find({ limit, offset })` — paginated find
- `brain.streaming.entities(filter)` — streaming alternative for very large traversals
