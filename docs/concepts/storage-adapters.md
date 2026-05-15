---
title: Storage Adapter Inheritance Contract
slug: concepts/storage-adapters
public: true
category: concepts
template: concept
order: 6
description: How storage adapters extend Brainy's BaseStorage and FileSystemStorage to inherit multi-process safety, what plugin authors need to override, and the contract Brainy promises to keep stable.
next:
  - concepts/multi-process
  - guides/inspection
---

# Storage Adapter Inheritance Contract

Brainy's storage layer is designed for plugins to extend cleanly. A plugin
that subclasses `BaseStorage` or `FileSystemStorage` inherits new behavior
Brainy adds over time without code changes — provided the import resolution
brings in the right Brainy version at runtime.

This page documents what plugin authors can rely on, what they need to
override, and the install-time failure modes that the defensive
`hasStorageMethod()` guard exists to handle.

## The class hierarchy

```
BaseStorageAdapter         (counts, batch ops, multi-tenancy hooks)
        ↑
BaseStorage                (COW, type-statistics, lifecycle helpers,
                            default no-op multi-process methods)
        ↑
FileSystemStorage          (real filesystem I/O, writer-lock implementation,
                            flush-request watcher, atomic writes)
        ↑
<your plugin's storage>    (Cortex's MmapFileSystemStorage, etc.)
```

When you `extend FileSystemStorage`, your adapter inherits every method on
the chain — including the ones Brainy adds in a later release — for free.
JavaScript's prototype chain resolves method lookups dynamically; nothing
about the inheritance is baked in at class-definition time.

## What you inherit for free

A plugin whose storage class extends `FileSystemStorage` automatically gets
the full multi-process safety surface:

| Method | What it does | Override? |
|---|---|---|
| `acquireWriterLock(opts)` | Write `_writer.lock`, start heartbeat, throw on conflict | No |
| `releaseWriterLock()` | Clean up lock file + heartbeat timer | No |
| `readWriterLock()` | Read lock file as `WriterLockInfo` | No |
| `startFlushRequestWatcher(cb)` | Poll `_flush_requests/` and invoke `cb` | No |
| `stopFlushRequestWatcher()` | Stop the polling timer | No |
| `requestFlushOverFilesystem(timeoutMs)` | Drop a `.req`, await `.ack` | No |
| `supportsMultiProcessLocking()` | Return `false` (default) | **Yes — override to `true`** |

The only required override is the capability flag. Returning `true` from
`supportsMultiProcessLocking()` is the signal Brainy uses to decide whether
to call `acquireWriterLock()` at init.

```typescript
import { FileSystemStorage } from '@soulcraft/brainy'

export class MmapFileSystemStorage extends FileSystemStorage {
  public supportsMultiProcessLocking(): boolean {
    return true
  }
  // ... your mmap-specific overrides ...
}
```

That's the full ceremony for inheriting multi-process safety.

## When NOT to extend FileSystemStorage

If your storage is **not filesystem-backed** (S3, GCS, R2, Azure, a custom
network backend), extend `BaseStorage` directly:

```typescript
import { BaseStorage } from '@soulcraft/brainy'

export class MyCloudStorage extends BaseStorage {
  // BaseStorage's default no-op implementations of the multi-process
  // methods stay in effect. `supportsMultiProcessLocking()` returns false
  // by default — keep it that way unless you've implemented an object-
  // versioned lease or similar cross-process synchronization for your
  // backend.
}
```

Brainy treats cloud backends as not-multi-process-safe by default and logs a
one-line warning at init. That's the correct behavior until cloud locking
ships (currently out of scope — see
[`concepts/multi-process`](./multi-process.md)).

## What `hasStorageMethod()` actually guards against

The defensive check at every new-storage-method call site (`brainy.ts`,
`hasStorageMethod(name)`) does **not** exist to handle "plugin bundles a
stale BaseStorage." Plugins ship a dist that preserves the dynamic ESM
import (verify in your plugin's `dist/`: `import { FileSystemStorage } from
'@soulcraft/brainy'` is not rewritten to a vendored copy). The prototype
chain at runtime resolves to whatever Brainy version your consumer has
installed.

`hasStorageMethod()` protects against **build/install artifacts** that break
the prototype chain at the consumer-app level:

- **Stale `node_modules`** — a lingering install from before the consumer
  upgraded Brainy. The package.json says `@soulcraft/brainy@7.22.0` but
  `node_modules/@soulcraft/brainy` is still 7.20.x.
- **Lockfile drift** — `bun.lockb` / `package-lock.json` pins a brainy
  version older than the package.json range, and `bun install` honors the
  lockfile.
- **Docker layer cache** — the image reuses a `node_modules` from an
  earlier build that predates the brainy bump.
- **Bundler quirks** — some bundlers (esbuild, webpack) flatten the
  prototype chain at build time and lose later prototype mutations. Brainy
  doesn't mutate prototypes at runtime, but bundler behavior can still
  cause method lookups to fail in non-Node environments.

In any of those, calling `storage.acquireWriterLock(...)` unconditionally
throws `TypeError: storage.acquireWriterLock is not a function`. The guard
turns that into a logged warning + graceful no-op so the app still boots,
and the warning names the adapter class plus a remediation hint:

```
[brainy] Storage adapter `MmapFileSystemStorage` is missing the multi-process
methods on its prototype chain. Writer locking and the flush-request RPC are
disabled for this directory. Likely fix: clean install (`rm -rf node_modules
bun.lockb && bun install`) or rebuild your container image to refresh
`@soulcraft/brainy` to ≥7.21. See docs/concepts/storage-adapters.md.
```

## Authoring a new storage adapter — minimum checklist

1. **Extend the right base class.**
   - Filesystem-backed → `FileSystemStorage`.
   - Cloud / network / custom → `BaseStorage`.

2. **Override the capability flag.** If filesystem-backed:
   ```typescript
   public supportsMultiProcessLocking(): boolean { return true }
   ```

3. **Don't `super.X()`-wrap the multi-process methods**. They're inherited;
   leaving them inherited means `hasStorageMethod()` finds them on the
   prototype chain. Re-declaring them as `super.X()` wrappers makes the
   helper resolve to your wrapper, which can fool the guard if your
   constructor runs before the super class initializes.

4. **Do override `init()` / `flush()` / `close()`** as needed. Always call
   `super.init()` / `super.flush()` / `super.close()` first so the
   filesystem prep, writer-lock acquisition, and lock release happen in the
   expected order.

5. **Verify the inheritance.** A one-line smoke test in your plugin's
   `__tests__/`:
   ```typescript
   const s = new MyStorage(rootDir)
   await s.init()
   assert(typeof s.acquireWriterLock === 'function')
   assert(s.supportsMultiProcessLocking() === true)
   ```
   If `acquireWriterLock` is undefined the prototype chain is broken at
   install time — fix install, not your plugin.

6. **Pin your peer dep generously.** `"peerDependencies": {
   "@soulcraft/brainy": "^7.21.0" }` accepts any compatible 7.x. Don't pin
   to an exact patch unless you're tracking a known regression.

## Future direction

The 7 multi-process methods are currently defaults on `BaseStorage`. A
future refactor may extract them into a `MultiProcessSafeStorage`
interface/mixin for cleaner separation — only adapters that opt in would
expose them. This would require a minor bump and is tracked as an internal
follow-up; consumers don't need to anticipate the change.

## Reading material

- [`concepts/multi-process`](./multi-process.md) — the writer-lock model,
  heartbeat semantics, what the lock protects.
- [`guides/inspection`](../guides/inspection.md) — `brainy inspect` and the
  read-only mode.
- `node_modules/@soulcraft/brainy/dist/storage/baseStorage.d.ts` — the
  authoritative type signatures for every method this page references.
