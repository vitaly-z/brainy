/**
 * @description Brainy 8.0 IdSpace contract: the JS fallback
 * `EntityIdMapper` caps at `u32::MAX` to match the metadata index's
 * Roaring32 bitmap width. When `nextId` would exceed the ceiling,
 * `getOrAssign` throws `EntityIdSpaceExceeded` with a message pointing
 * at the cortex 3.0 binary mapper's `idSpace: 'u64'` mode as the
 * migration path.
 *
 * This is the lockstep counterpart to cortex 3.0's Piece 10 / Step 15
 * (TS wrapper + napi BigInt siblings + Roaring32-or-Treemap
 * `PostingList` enum). Without this guard, a JS-only brainy install
 * past 4.29 B entities would silently truncate entity ids into the
 * low-32-bit range, zeroing query results and corrupting any
 * persisted int-keyed structure that consumed the mapper.
 */

import { describe, it, expect } from 'vitest'
import {
  EntityIdMapper,
  EntityIdSpaceExceeded,
  U32_ENTITY_ID_MAX,
} from '../../../src/utils/entityIdMapper.js'

/**
 * Construct a fresh in-memory mapper without going through brainy's
 * full storage adapter — we only exercise the in-RAM ceiling guard
 * here, so a minimal `getMetadata`-returning shim is enough.
 */
function makeMapper(): EntityIdMapper {
  const storage = {
    getMetadata: async () => null,
    setMetadata: async () => {},
    getNouns: async () => ({ items: [], totalCount: 0 }),
  } as any
  return new EntityIdMapper({ storage })
}

describe('EntityIdMapper U32 IdSpace ceiling (Brainy 8.0)', () => {
  it('U32_ENTITY_ID_MAX equals 0xFFFF_FFFF (u32 ceiling)', () => {
    expect(U32_ENTITY_ID_MAX).toBe(0xffff_ffff)
  })

  it('EntityIdSpaceExceeded is an Error subclass with attempted + ceiling', () => {
    const err = new EntityIdSpaceExceeded(0xffff_ffff + 1)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('EntityIdSpaceExceeded')
    expect(err.ceiling).toBe(0xffff_ffff)
    expect(err.attempted).toBe(0x1_0000_0000)
    expect(err.message).toMatch(/u32::MAX/)
    expect(err.message).toMatch(/cortex/)
    expect(err.message).toMatch(/idSpace: 'u64'/)
  })

  it('normal allocations under the ceiling succeed', async () => {
    const m = makeMapper()
    await m.init()
    const a = m.getOrAssign('uuid-a')
    const b = m.getOrAssign('uuid-b')
    expect(a).toBe(1)
    expect(b).toBe(2)
    expect(a).not.toBe(b)
  })

  it('throws EntityIdSpaceExceeded when nextId would exceed u32::MAX', async () => {
    const m = makeMapper()
    await m.init()
    // Reach into the mapper to bump `nextId` past the ceiling without
    // actually allocating 4.29 B entities at test time. This mirrors
    // the runtime invariant the guard protects.
    ;(m as any).nextId = U32_ENTITY_ID_MAX + 1
    expect(() => m.getOrAssign('uuid-overflow')).toThrow(EntityIdSpaceExceeded)
  })

  it('the last representable u32 int IS allocatable (boundary case)', async () => {
    const m = makeMapper()
    await m.init()
    ;(m as any).nextId = U32_ENTITY_ID_MAX
    // `nextId === U32_ENTITY_ID_MAX` is still within range — the
    // guard checks `> U32_ENTITY_ID_MAX`, so this last allocation
    // succeeds.
    const id = m.getOrAssign('uuid-at-ceiling')
    expect(id).toBe(U32_ENTITY_ID_MAX)
    // The NEXT allocation overflows.
    expect(() => m.getOrAssign('uuid-after-ceiling')).toThrow(
      EntityIdSpaceExceeded,
    )
  })

  it('existing uuid lookup never overflows even when nextId is past ceiling', async () => {
    const m = makeMapper()
    await m.init()
    const assigned = m.getOrAssign('uuid-existing')
    ;(m as any).nextId = U32_ENTITY_ID_MAX + 1
    // Looking up an already-assigned UUID does NOT allocate; the
    // guard is on the assign path only.
    expect(m.getOrAssign('uuid-existing')).toBe(assigned)
  })
})
