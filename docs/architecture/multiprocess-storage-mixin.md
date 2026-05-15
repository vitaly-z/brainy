# Design note: multi-process storage mixin

**Status:** Proposed (future minor)
**Owner:** Brainy core
**Filed:** 2026-05-15
**Companion:** [`concepts/storage-adapters`](../concepts/storage-adapters.md)

## Context

Brainy 7.21 added seven storage-adapter methods to support multi-process
safety:

```
supportsMultiProcessLocking()
acquireWriterLock(opts)
releaseWriterLock()
readWriterLock()
startFlushRequestWatcher(cb)
stopFlushRequestWatcher()
requestFlushOverFilesystem(timeoutMs)
```

They live on `BaseStorage` as no-op defaults and are overridden on
`FileSystemStorage` with real implementations. Any adapter extending
`FileSystemStorage` (e.g. Cortex's `MmapFileSystemStorage`) inherits the
real ones for free.

This works correctly today. The question is whether the methods *belong*
on `BaseStorage`.

## The case for moving them out

`BaseStorage` already mixes several concerns:
- entity / verb CRUD primitives
- COW (copy-on-write) lifecycle
- type-statistics tracking
- count persistence
- multi-process safety (new)

Adapters that have no notion of multi-process semantics — `MemoryStorage`,
cloud adapters (S3, GCS, R2, Azure, OPFS) — still carry seven inherited
no-ops on their prototype chain. A reader can't tell from the class
declaration whether a given adapter participates in the locking protocol;
it has to call `supportsMultiProcessLocking()` and trust the answer.

A cleaner separation:

```typescript
interface MultiProcessSafeStorage {
  supportsMultiProcessLocking(): boolean
  acquireWriterLock(opts?: { force?: boolean }): Promise<WriterLockInfo | null>
  releaseWriterLock(): Promise<void>
  readWriterLock(): Promise<WriterLockInfo | null>
  startFlushRequestWatcher(cb: () => Promise<void>): void
  stopFlushRequestWatcher(): void
  requestFlushOverFilesystem(timeoutMs: number): Promise<boolean>
}

function isMultiProcessSafe(s: BaseStorage): s is BaseStorage & MultiProcessSafeStorage {
  return typeof (s as any).supportsMultiProcessLocking === 'function'
    && (s as any).supportsMultiProcessLocking()
}
```

Brainy's call sites become:

```typescript
if (this.config.mode !== 'reader' && isMultiProcessSafe(this.storage)) {
  await this.storage.acquireWriterLock({ force: this.config.force })
  // ... TypeScript narrows the rest correctly ...
}
```

Benefits:
- Type system enforces the capability — no more `(this.storage as any).X()`.
- Adapters that opt out (memory, cloud) are visibly clean.
- `hasStorageMethod()` defensive helper can stay (still guards
  build/install artifacts) but doesn't carry the conceptual weight of
  "did the plugin implement the interface."
- ADR-style trail for future capability additions: each new capability
  gets its own interface, opted into explicitly.

## The case against doing it now

- Breaking change for any adapter that already overrides these methods.
  `FileSystemStorage` is the only one in-tree, but Cortex's
  `MmapFileSystemStorage` inherits from it — interface relocation would
  ripple through the plugin ecosystem.
- The current state works. Real failure modes
  (BR-CX-INTERFACE-GAP) were build/install artifacts, not type-system
  failures.
- 7.22.0 just shipped a clean fix. Stacking another refactor before
  consumers absorb it adds churn without urgency.
- The `hasStorageMethod()` guard accomplishes the same runtime safety the
  interface narrowing would in TypeScript-aware code.

## Recommendation

**Defer.** Keep the current architecture through the 7.x line. Revisit
when:
- A second multi-process capability lands (e.g. distributed-readers
  coordination) and the natural surface area is more than seven
  methods. Five+ becomes the moment a separate interface earns its
  keep.
- A v8 major is on the table for unrelated reasons. Bundle the
  interface extraction with that release so consumers absorb both
  changes in one upgrade.

Until then:
- Document the inheritance contract (done — see
  [`concepts/storage-adapters`](../concepts/storage-adapters.md)).
- Keep `hasStorageMethod()` as the runtime guard.
- Don't add new methods to `BaseStorage` defaults without re-evaluating
  the surface-area boundary.

## Migration sketch (when we do it)

For reference, a clean migration path:

1. Add `MultiProcessSafeStorage` interface to `src/storage/coreTypes.ts`.
2. Move the seven method signatures from `BaseStorage` to the new
   interface. Default implementations stay on `BaseStorage` but only as
   private helpers consumed by `FileSystemStorage`'s explicit
   implementations.
3. `FileSystemStorage implements MultiProcessSafeStorage` becomes
   explicit; methods get the `public` modifier with full JSDoc.
4. Brainy call sites switch from `hasStorageMethod` to
   `isMultiProcessSafe` type-guard. Keep `hasStorageMethod` for
   build/install artifact protection.
5. Document the new contract in `concepts/storage-adapters.md`.
6. Major-version-bump the `@soulcraft/brainy` peerDep range expected by
   plugins.

Estimated work: ~half a day of code, ~2 hours of doc/example updates,
ecosystem coordination via the platform handoff.
