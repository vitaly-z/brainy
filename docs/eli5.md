---
title: What is Brainy?
slug: getting-started/what-is-brainy
public: true
category: getting-started
template: guide
order: 0
description: Plain-language guide covering what Brainy does, how it compares to other tools, and what you can build with it. No jargon, no code — just clear analogies.
next:
  - getting-started/installation
  - getting-started/quick-start
---

# Brainy and Cortex — Explained Simply

*A plain-language guide for anyone who wants to understand what this thing actually does.*

---

## What is Brainy?

Imagine you have the world's smartest librarian.

You walk up and say *"I'm looking for something about climate change — but only books published after 2020, and only ones written by authors I've already read."* A normal library would make you dig through a card catalogue, then cross-reference a list of authors, then scan the shelves yourself. That takes a while.

Your smart librarian does all three at the same time — in less than the time it takes to blink.

That's Brainy. It's a knowledge database that can search by **meaning**, follow **connections**, and filter by **labels** — all at once, in a single question.

---

## The Three Superpowers

### 1. Meaning Search (the "fuzzy" superpower)

When you search for "automobile," Brainy also finds results about "car," "vehicle," and "sedan" — because it understands what words *mean*, not just how they're spelled. It reads your data the way a person would, not the way a search box does.

Think of it like the librarian who finds books on "heartbreak" when you ask for something about "loneliness."

### 2. Relationship Walking (the "follow the thread" superpower)

Every piece of information can be connected to other pieces. A Person *works at* a Company. A Project *depends on* a Tool. A Recipe *contains* Ingredients.

Brainy can follow these connections across many hops in one step. Ask for "everything connected to this author, two steps out" and Brainy returns the author's books, the books' publishers, the publishers' other authors — without you needing to chain four separate lookups yourself.

Think of it like the librarian who not only hands you the book you asked for, but also knows which shelf it came from, who donated it, and what other books arrived in the same donation.

### 3. Label Filtering (the "narrow it down" superpower)

Sometimes meaning and connections aren't enough — you need precision. "Only recipes with fewer than 500 calories." "Only events from last week." "Only documents tagged as urgent."

Brainy can narrow any result set down by exact labels or ranges in the same breath as the other two searches. No extra steps.

---

## What Else Can It Do?

- **Virtual file cabinet.** Brainy includes a full filesystem you can use to store, organize, and semantically search files — PDFs, documents, anything — the same way you search everything else.

- **Live dashboards.** You can define running totals that Brainy keeps updated automatically — things like "total sales this month by region" or "average response time per service." Every time new data comes in, the numbers stay current with no manual recalculation.

- **Safe experiments.** You can branch your entire knowledge base — like branching code in version control — make changes on the branch, and either keep them or throw them away without ever touching the original.

- **Universal vocabulary.** Brainy ships with a shared language of 42 kinds of things (Person, Document, Task, Concept, Event…) and 127 kinds of connections (Contains, DependsOn, Creates, RelatedTo…). This means data from different sources speaks the same language without you having to translate.

---

## What is Cortex?

Cortex is a turbocharger for Brainy.

Same car. Same controls. Same fuel. You just swap in a faster engine under the hood, and everything that used to take a moment now happens instantly.

Technically, Cortex is an optional plugin written in Rust — a lower-level language that runs much closer to the raw metal of your processor. It plugs into Brainy and takes over the most compute-intensive work: the distance calculations that power meaning search, the number-crunching behind live aggregates, and the set operations that drive label filtering.

You install it with one line, register it with one call, and Brainy automatically uses it everywhere it can help.

---

## How Much Faster?

Plain language:

- **Searches** go from "the blink of an eye" to "faster than a blink." The overall speedup is **5.2× on average** across all operations.
- **Live aggregates** are rebuilt using all CPU cores in parallel, so re-indexing large datasets takes a fraction of the time.
- **Analytics** that aren't even possible in pure JavaScript — real-time anomaly detection, streaming percentile estimates, approximate unique counts — become available because Cortex brings the native capabilities required to run them efficiently.

If Brainy is what makes knowledge fast, Cortex is what makes Brainy feel instant.

---

## What Does Brainy Replace?

Most applications that need to store and search knowledge end up stitching together several specialized tools. Brainy replaces all of them with one — a single free, open-source library in place of multiple paid services.

### Before and After

**Before Brainy** — a pile of services:
- Pinecone (vectors) + Neo4j (graph) + MongoDB (docs)
- Algolia (search) + Redis (cache) + PostgreSQL + pgvector
- Plus glue code, sync jobs, ETL pipelines, and 3am incidents

**After Brainy** — one thing:
Search, graph, filter, files, branches, and imports — unified in a single query.

### What Each Tool Is Missing

| Tool | Search | Graph | Filter | VFS | Branch | Import |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Brainy** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| *— Vector databases —* | | | | | | |
| Pinecone | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Weaviate | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Qdrant | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Chroma | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| *— Graph databases —* | | | | | | |
| Neo4j | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| *— Document stores —* | | | | | | |
| MongoDB | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Firestore | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| DynamoDB | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| *— Relational + vector —* | | | | | | |
| PostgreSQL + pgvector | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| MySQL | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| SQLite | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| *— Search engines —* | | | | | | |
| Elasticsearch | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Algolia | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| *— Cache —* | | | | | | |
| Redis | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

Brainy is the only row with every box checked. And it runs all of them in a single query — no stitching services together.

### One library, any scale

Brainy scales from a single laptop to billions of entities without changing a line of code. Small datasets live in memory. Larger ones spill to disk. At cloud scale, Brainy uses S3-compatible storage and automatically shards across nodes — the same API the whole way. Up to ten billion entities is fully implemented today.

Add Cortex and you also unlock memory-mapped storage — aggregate state lives directly in the operating system's memory with zero serialization overhead, as fast as the hardware allows.

---

## What Can You Build?

### Common applications

- **AI agents with persistent memory** — Give any AI an always-on, self-organizing knowledge graph that persists between sessions and across agents.
- **Searchable knowledge bases** — Build institutional memory that links documents automatically and surfaces answers across the full web of related information.
- **Semantic document search** — Index PDFs, code, or media and find them by meaning, not just keywords.
- **Relationship-aware recommendations** — Power product catalogs or content platforms where every recommendation understands what connects to what.
- **Safe experiments** — Let teams branch the knowledge base, experiment independently, and merge when ready — just like branching code.
- **Unified business platforms** — Combine booking, CRM, inventory, and analytics in one queryable knowledge graph with no sync pipeline.

### Built with Brainy

Real products built on Brainy — live in production at Soulcraft:

- **Workshop** — AI-powered IDE and creation studio where imagination meets creation.
- **Venue** — Unified physical + digital business operations, from food truck to franchise.
- **Memory** — Infinite context for AI agents that never forgets.
- **Collective** — Multi-agent coordination with shared knowledge and automatic task routing.
- **Heart** — Emotional intelligence and empathy layer for AI communication.
