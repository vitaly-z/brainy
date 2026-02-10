/**
 * Migration registry
 *
 * Ordered array of migrations. Each migration runs exactly once per storage instance.
 * Add new migrations at the end — order matters.
 */

import type { Migration } from './types.js'

export const MIGRATIONS: Migration[] = [
  // Empty for v7.16.0 — framework scaffolded, ready for future use.
  // Example of a future migration:
  //
  // {
  //   id: '7.17.0-rename-status-field',
  //   version: '7.17.0',
  //   description: 'Rename metadata.state to metadata.status',
  //   applies: 'nouns',
  //   transform: (m) => 'state' in m ? { ...m, status: m.state, state: undefined } : null
  // }
]
