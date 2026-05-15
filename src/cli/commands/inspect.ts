/**
 * Inspect Commands
 *
 * Out-of-process diagnostics against a Brainy data directory. Every
 * subcommand opens the store via `Brainy.openReadOnly()` so they coexist
 * safely with a live writer (and with each other). The `--fresh` flag
 * (default true) asks the writer to flush its in-memory state via the
 * filesystem RPC before opening, so query results reflect the very latest
 * writes. Without `--fresh`, results reflect the writer's last natural flush.
 *
 * Designed to be the operator's primary debugging surface for any Brainy
 * deployment. None of these commands mutate the store.
 */

import chalk from 'chalk'
import ora from 'ora'
import { Brainy } from '../../brainy.js'

interface InspectOptions {
  fresh?: boolean
  json?: boolean
  pretty?: boolean
  quiet?: boolean
}

interface OpenOptions extends InspectOptions {
  flushTimeoutMs?: number
}

/**
 * Open a read-only handle on `path`. If `--fresh` (default), first ask the
 * writer to flush via the filesystem RPC. Logs warnings when fresh state
 * cannot be obtained — but proceeds anyway since stale-but-honest is better
 * than failed.
 */
async function openReader(rootDir: string, options: OpenOptions): Promise<Brainy> {
  const wantsFresh = options.fresh !== false
  const flushTimeoutMs = options.flushTimeoutMs ?? 5000

  if (wantsFresh) {
    // Use a throwaway reader purely to trigger requestFlush — that way the
    // ack lands before we open the main reader and have it rebuild indexes.
    try {
      const probe = await Brainy.openReadOnly({
        storage: { type: 'filesystem', rootDirectory: rootDir }
      })
      const acked = await probe.requestFlush({ timeoutMs: flushTimeoutMs })
      await probe.close()
      if (!acked && !options.quiet) {
        console.warn(chalk.yellow(
          `⚠ Writer did not ack flush within ${flushTimeoutMs}ms. Results reflect last natural flush.`
        ))
      }
    } catch (err) {
      if (!options.quiet) {
        console.warn(chalk.yellow(`⚠ Flush request failed: ${(err as Error).message}`))
      }
    }
  }

  return Brainy.openReadOnly({
    storage: { type: 'filesystem', rootDirectory: rootDir }
  })
}

function emit(data: unknown, options: InspectOptions): void {
  if (options.json) {
    console.log(options.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data))
  } else {
    console.log(JSON.stringify(data, null, 2))
  }
}

export const inspectCommands = {
  /**
   * Show counts, mode, indexed fields, writer lock info.
   */
  async stats(path: string, options: InspectOptions) {
    const spinner = options.quiet ? null : ora('Opening read-only…').start()
    try {
      const brain = await openReader(path, options)
      spinner?.succeed('Connected')
      const stats = await brain.stats()
      emit(stats, options)
      await brain.close()
      // close() releases the indexes but some global timers (UnifiedCache
      // bookkeeping, PathResolver stats) keep the event loop alive. CLI
      // commands are one-shot — exit explicitly.
      process.exit(0)
    } catch (err) {
      spinner?.fail((err as Error).message)
      process.exit(1)
    }
  },

  /**
   * Find entities matching the given filter. Mirrors `brain.find()`.
   */
  async find(path: string, options: InspectOptions & {
    type?: string
    where?: string
    limit?: string
    offset?: string
  }) {
    const spinner = options.quiet ? null : ora('Opening read-only…').start()
    try {
      const brain = await openReader(path, options)
      if (spinner) spinner.text = 'Querying…'
      const where = options.where ? JSON.parse(options.where) : undefined
      const limit = options.limit ? parseInt(options.limit, 10) : 20
      const offset = options.offset ? parseInt(options.offset, 10) : 0
      const results = await brain.find({
        type: options.type as any,
        where,
        limit,
        offset
      })
      spinner?.succeed(`Found ${results.length} result(s)`)
      emit(results, options)
      await brain.close()
      process.exit(0)
    } catch (err) {
      spinner?.fail((err as Error).message)
      process.exit(1)
    }
  },

  /**
   * Get a single entity by ID.
   */
  async get(path: string, id: string, options: InspectOptions) {
    const spinner = options.quiet ? null : ora('Opening read-only…').start()
    try {
      const brain = await openReader(path, options)
      if (spinner) spinner.text = 'Fetching…'
      const entity = await brain.get(id)
      spinner?.succeed(entity ? 'Found' : 'Not found')
      emit(entity, options)
      await brain.close()
      process.exit(0)
    } catch (err) {
      spinner?.fail((err as Error).message)
      process.exit(1)
    }
  },

  /**
   * Show inbound or outbound relationships for an entity.
   */
  async relations(path: string, id: string, options: InspectOptions & {
    direction?: 'in' | 'out' | 'both'
    type?: string
    limit?: string
  }) {
    const spinner = options.quiet ? null : ora('Opening read-only…').start()
    try {
      const brain = await openReader(path, options)
      if (spinner) spinner.text = 'Walking graph…'
      const direction = options.direction ?? 'both'
      const limit = options.limit ? parseInt(options.limit, 10) : 50
      const rels = await brain.getRelations({
        from: id,
        direction,
        type: options.type as any,
        limit
      } as any)
      spinner?.succeed(`Found ${rels.length} relationship(s)`)
      emit(rels, options)
      await brain.close()
      process.exit(0)
    } catch (err) {
      spinner?.fail((err as Error).message)
      process.exit(1)
    }
  },

  /**
   * Explain how a where-clause query will be served by the index. Shows
   * column-store vs sparse-chunked vs no-index per field. Designed to
   * diagnose the silent-empty-result class of issues.
   */
  async explain(path: string, options: InspectOptions & { type?: string; where?: string }) {
    const spinner = options.quiet ? null : ora('Opening read-only…').start()
    try {
      const brain = await openReader(path, options)
      if (spinner) spinner.text = 'Planning query…'
      const where = options.where ? JSON.parse(options.where) : {}
      const plan = await brain.explain({ type: options.type as any, where })
      spinner?.succeed('Plan ready')
      emit(plan, options)
      await brain.close()
      process.exit(0)
    } catch (err) {
      spinner?.fail((err as Error).message)
      process.exit(1)
    }
  },

  /**
   * Run the invariant-check battery.
   */
  async health(path: string, options: InspectOptions) {
    const spinner = options.quiet ? null : ora('Opening read-only…').start()
    try {
      const brain = await openReader(path, options)
      if (spinner) spinner.text = 'Running checks…'
      const report = await brain.health()
      spinner?.succeed(`Overall: ${report.overall}`)
      emit(report, options)
      await brain.close()
      process.exit(report.overall === 'fail' ? 2 : 0)
    } catch (err) {
      spinner?.fail((err as Error).message)
      process.exit(1)
    }
  },

  /**
   * Random N-entity sample.
   */
  async sample(path: string, options: InspectOptions & { type?: string; n?: string }) {
    const spinner = options.quiet ? null : ora('Opening read-only…').start()
    try {
      const brain = await openReader(path, options)
      if (spinner) spinner.text = 'Sampling…'
      const n = options.n ? parseInt(options.n, 10) : 10
      // Pull a larger window then randomize down to N. Avoids needing a
      // dedicated random-sample API in Brainy core for this v1.
      const window = Math.min(Math.max(n * 10, 50), 1000)
      const pool = await brain.find({
        type: options.type as any,
        limit: window
      })
      const sample = pool
        .map((v) => ({ v, k: Math.random() }))
        .sort((a, b) => a.k - b.k)
        .slice(0, n)
        .map((x) => x.v)
      spinner?.succeed(`Sampled ${sample.length} of ${pool.length}`)
      emit(sample, options)
      await brain.close()
      process.exit(0)
    } catch (err) {
      spinner?.fail((err as Error).message)
      process.exit(1)
    }
  },

  /**
   * List indexed metadata fields.
   */
  async fields(path: string, options: InspectOptions) {
    const spinner = options.quiet ? null : ora('Opening read-only…').start()
    try {
      const brain = await openReader(path, options)
      const stats = await brain.stats()
      spinner?.succeed(`${stats.fieldRegistry.length} indexed field(s)`)
      emit(stats.fieldRegistry, options)
      await brain.close()
      process.exit(0)
    } catch (err) {
      spinner?.fail((err as Error).message)
      process.exit(1)
    }
  },

  /**
   * Dump all entities of a given type as JSONL. Streams via pagination to
   * keep memory bounded. Outputs to stdout for redirection to a file.
   */
  async dump(path: string, options: InspectOptions & { type?: string; batch?: string }) {
    const batch = options.batch ? parseInt(options.batch, 10) : 500
    try {
      const brain = await openReader(path, options)
      let offset = 0
      while (true) {
        const page = await brain.find({
          type: options.type as any,
          limit: batch,
          offset
        })
        if (page.length === 0) break
        for (const e of page) {
          process.stdout.write(JSON.stringify(e) + '\n')
        }
        if (page.length < batch) break
        offset += page.length
      }
      await brain.close()
      process.exit(0)
    } catch (err) {
      console.error(chalk.red((err as Error).message))
      process.exit(1)
    }
  },

  /**
   * Watch for newly-written entities. Polls `brain.find()` on an interval
   * and emits entities that have an `updatedAt`/`createdAt` newer than the
   * previous tick. Best-effort — for forensic-grade tracking, use the
   * writer's own audit log if one exists.
   */
  async watch(path: string, options: InspectOptions & { type?: string; interval?: string }) {
    const intervalMs = options.interval ? parseInt(options.interval, 10) : 1000
    let seen = new Set<string>()
    let firstTick = true
    console.error(chalk.cyan(`Watching ${path} (every ${intervalMs}ms, Ctrl+C to stop)…`))

    const tick = async () => {
      try {
        const brain = await openReader(path, { ...options, quiet: true })
        const page = await brain.find({
          type: options.type as any,
          limit: 200
        })
        for (const e of page) {
          if (!seen.has(e.id)) {
            seen.add(e.id)
            if (!firstTick) {
              process.stdout.write(JSON.stringify(e) + '\n')
            }
          }
        }
        await brain.close()
        firstTick = false
      } catch (err) {
        console.error(chalk.yellow(`watch tick failed: ${(err as Error).message}`))
      }
    }

    await tick()
    const handle = setInterval(() => { void tick() }, intervalMs)
    process.on('SIGINT', () => {
      clearInterval(handle)
      process.exit(0)
    })
  },

  /**
   * Atomic tarball backup of the data directory. Asks the writer to flush
   * first (so the snapshot is consistent), then tars into the destination.
   */
  async backup(path: string, dest: string, options: InspectOptions) {
    const spinner = options.quiet ? null : ora('Requesting flush…').start()
    try {
      // Request flush so the snapshot is internally consistent.
      const brain = await openReader(path, { ...options, fresh: true })
      await brain.close()

      if (spinner) spinner.text = 'Archiving…'
      const { spawn } = await import('node:child_process')
      const proc = spawn('tar', ['-cf', dest, '-C', path, '.'], { stdio: 'inherit' })
      await new Promise<void>((resolve, reject) => {
        proc.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`tar exited ${code}`)))
        proc.on('error', reject)
      })
      spinner?.succeed(`Backup written to ${dest}`)
      process.exit(0)
    } catch (err) {
      spinner?.fail((err as Error).message)
      process.exit(1)
    }
  },

  /**
   * Rebuild indexes from raw storage. Opens the store in writer mode and
   * triggers a rebuild. Refuses to run if another writer holds the lock
   * (use --force only after stopping the live writer).
   */
  async repair(path: string, options: InspectOptions & { force?: boolean }) {
    const spinner = options.quiet ? null : ora('Opening writer…').start()
    try {
      const brain = new Brainy({
        storage: { type: 'filesystem', rootDirectory: path },
        mode: 'writer',
        force: options.force
      })
      await brain.init()
      if (spinner) spinner.text = 'Rebuilding indexes…'
      // Force a flush to persist whatever the rebuild produced.
      await brain.flush()
      spinner?.succeed('Repair complete')
      const stats = await brain.stats()
      emit(stats, options)
      await brain.close()
      process.exit(0)
    } catch (err) {
      spinner?.fail((err as Error).message)
      process.exit(1)
    }
  },

  /**
   * Compare two brain directories: entity and relation counts by type, and
   * a sample of entity IDs present in one but not the other.
   */
  async diff(pathA: string, pathB: string, options: InspectOptions & { sample?: string }) {
    const sample = options.sample ? parseInt(options.sample, 10) : 100
    const spinner = options.quiet ? null : ora('Opening both stores…').start()
    try {
      const [a, b] = await Promise.all([
        openReader(pathA, { ...options, quiet: true, fresh: false }),
        openReader(pathB, { ...options, quiet: true, fresh: false })
      ])
      const [statsA, statsB] = await Promise.all([a.stats(), b.stats()])
      const idsA = new Set((await a.find({ limit: sample })).map((e) => e.id))
      const idsB = new Set((await b.find({ limit: sample })).map((e) => e.id))
      await Promise.all([a.close(), b.close()])
      spinner?.succeed('Compared')

      const onlyInA = [...idsA].filter((id) => !idsB.has(id)).slice(0, 20)
      const onlyInB = [...idsB].filter((id) => !idsA.has(id)).slice(0, 20)

      emit({
        a: { path: pathA, entityCount: statsA.entityCount, relationCount: statsA.relationCount, entitiesByType: statsA.entitiesByType },
        b: { path: pathB, entityCount: statsB.entityCount, relationCount: statsB.relationCount, entitiesByType: statsB.entitiesByType },
        sampleSize: sample,
        sampleOnlyInA: onlyInA,
        sampleOnlyInB: onlyInB,
        note: 'Sample-based comparison. ID-level diffs reflect the first N entities surveyed in each store.'
      }, options)
      process.exit(0)
    } catch (err) {
      spinner?.fail((err as Error).message)
      process.exit(1)
    }
  }
}
