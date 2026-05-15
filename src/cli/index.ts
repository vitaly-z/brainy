#!/usr/bin/env node

/**
 * Brainy CLI - Enterprise Neural Intelligence System
 * 
 * Full TypeScript implementation with type safety and shared code
 */

import { Command } from 'commander'
import chalk from 'chalk'
import { neuralCommands } from './commands/neural.js'
import { coreCommands } from './commands/core.js'
import { utilityCommands } from './commands/utility.js'
import { vfsCommands } from './commands/vfs.js'
import { dataCommands } from './commands/data.js'
import { storageCommands } from './commands/storage.js'
import { nlpCommands } from './commands/nlp.js'
import { insightsCommands } from './commands/insights.js'
import { importCommands } from './commands/import.js'
import { cowCommands } from './commands/cow.js'
import { inspectCommands } from './commands/inspect.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'))
const version = packageJson.version

// CLI Configuration
const program = new Command()

program
  .name('brainy')
  .description('🧠 Brainy - The Knowledge Operating System')
  .version(version, '-V, --version', 'Show version number')
  .option('-v, --verbose', 'Verbose output')
  .option('--json', 'JSON output format')
  .option('--pretty', 'Pretty JSON output')
  .option('--no-color', 'Disable colored output')
  .option('-q, --quiet', 'Suppress non-essential output')
  .addHelpText('after', `
${chalk.cyan('Examples:')}
  ${chalk.dim('# Core operations')}
  $ brainy add "React is a JavaScript library"
  $ brainy find "JavaScript frameworks"
  $ brainy update <id> --content "Updated content"
  $ brainy delete <id>  ${chalk.dim('# Requires confirmation')}
  $ brainy search "react" --type Component --where '{"tested":true}'

  ${chalk.dim('# Neural API')}
  $ brainy similar "react" "vue"
  $ brainy cluster --algorithm kmeans
  $ brainy related <id> --limit 10

  ${chalk.dim('# NLP & Entity Extraction')}
  $ brainy extract "Apple announced new iPhone in California"
  $ brainy extract-concepts "Machine learning enables AI"
  $ brainy analyze "Full text analysis with sentiment"

  ${chalk.dim('# Insights & Analytics')}
  $ brainy insights  ${chalk.dim('# Database analytics')}
  $ brainy fields  ${chalk.dim('# All metadata fields')}
  $ brainy field-values status  ${chalk.dim('# Values for a field')}
  $ brainy query-plan --filters '{"status":"active"}'

  ${chalk.dim('# VFS operations')}
  $ brainy vfs ls /projects
  $ brainy vfs search "React components"
  $ brainy vfs similar /code/Button.tsx

  ${chalk.dim('# Storage management')}
  $ brainy storage status --quota
  $ brainy storage lifecycle set ${chalk.dim('# Interactive mode')}
  $ brainy storage cost-estimate
  $ brainy storage batch-delete old-ids.txt

  ${chalk.dim('# Interactive mode')}
  $ brainy interactive

${chalk.cyan('Documentation:')}
  ${chalk.dim('Full docs:')} https://github.com/soulcraftlabs/brainy
  ${chalk.dim('Report issues:')} https://github.com/soulcraftlabs/brainy/issues

${chalk.yellow('💡 Tip:')} All commands work interactively if you omit parameters!
  `)

// ===== Core Commands =====

program
  .command('add [text]')
  .description('Add text or JSON to the neural database (interactive if no text)')
  .option('-i, --id <id>', 'Specify custom ID')
  .option('-m, --metadata <json>', 'Add metadata')
  .option('-t, --type <type>', 'Specify noun type')
  .action(coreCommands.add)

program
  .command('find [query]')
  .description('Simple NLP search (interactive if no query)')
  .option('-k, --limit <number>', 'Number of results', '10')
  .action(coreCommands.search)

program
  .command('search [query]')
  .description('Advanced search with Triple Intelligence™ (interactive if no query)')
  .option('-k, --limit <number>', 'Number of results', '10')
  .option('--offset <number>', 'Skip N results (pagination)')
  .option('-t, --threshold <number>', 'Similarity threshold (0-1)', '0.7')
  .option('--type <types>', 'Filter by type(s) - comma separated')
  .option('--where <json>', 'Metadata filters (JSON)')
  .option('--near <id>', 'Find items near this ID')
  .option('--connected-to <id>', 'Connected to this entity')
  .option('--connected-from <id>', 'Connected from this entity')
  .option('--via <verbs>', 'Via these relationships - comma separated')
  .option('--explain', 'Show scoring breakdown')
  .option('--include-relations', 'Include entity relationships')
  .option('--fusion <strategy>', 'Fusion strategy (adaptive|weighted|progressive)')
  .option('--vector-weight <n>', 'Vector search weight (0-1)')
  .option('--graph-weight <n>', 'Graph search weight (0-1)')
  .option('--field-weight <n>', 'Field search weight (0-1)')
  .action(coreCommands.search)

program
  .command('get [id]')
  .description('Get item by ID (interactive if no ID)')
  .option('--with-connections', 'Include connections')
  .action(coreCommands.get)

program
  .command('relate [source] [verb] [target]')
  .description('Create a relationship between items (interactive if parameters missing)')
  .option('-w, --weight <number>', 'Relationship weight')
  .option('-m, --metadata <json>', 'Relationship metadata')
  .action(coreCommands.relate)

program
  .command('update [id]')
  .description('Update an existing entity (interactive if no ID)')
  .option('-c, --content <text>', 'New content')
  .option('-m, --metadata <json>', 'Metadata to merge')
  .option('-t, --type <type>', 'New type')
  .action(coreCommands.update)

program
  .command('delete [id]')
  .description('Delete an entity (interactive if no ID, requires confirmation)')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(coreCommands.deleteEntity)

program
  .command('unrelate [id]')
  .description('Remove a relationship (interactive if no ID, requires confirmation)')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(coreCommands.unrelate)

program
  .command('import [source]')
  .description('Neural import from file, directory, or URL (interactive if no source)')
  .option('-f, --format <format>', 'Format (json|csv|jsonl|yaml|markdown|html|xml|text)')
  .option('--recursive', 'Import directories recursively')
  .option('--batch-size <number>', 'Batch size for import', '100')
  .option('--extract-concepts', 'Extract concepts as entities')
  .option('--extract-entities', 'Extract named entities (NLP)')
  .option('--detect-relationships', 'Auto-detect relationships', true)
  .option('--confidence <n>', 'Confidence threshold (0-1)', '0.5')
  .option('--progress', 'Show progress')
  .option('--skip-hidden', 'Skip hidden files')
  .option('--skip-node-modules', 'Skip node_modules', true)
  .action(importCommands.import)

program
  .command('export [file]')
  .description('Export database')
  .option('-f, --format <format>', 'Output format (json|csv|jsonl)', 'json')
  .action(coreCommands.export)

program
  .command('diagnostics')
  .alias('diag')
  .description('Show plugin and provider diagnostics')
  .option('--json', 'Output as JSON')
  .option('--pretty', 'Pretty print JSON')
  .action(coreCommands.diagnostics)

// ===== Neural Commands =====

program
  .command('similar [a] [b]')
  .alias('sim')
  .description('Calculate similarity between two items (interactive if parameters missing)')
  .option('--explain', 'Show detailed explanation')
  .option('--breakdown', 'Show similarity breakdown')
  .action(neuralCommands.similar)

program
  .command('cluster')
  .alias('clusters')
  .description('Find semantic clusters in the data (interactive mode available)')
  .option('--algorithm <type>', 'Clustering algorithm (hierarchical|kmeans|dbscan)', 'hierarchical')
  .option('--threshold <number>', 'Similarity threshold', '0.7')
  .option('--min-size <number>', 'Minimum cluster size', '2')
  .option('--max-clusters <number>', 'Maximum number of clusters')
  .option('--near <query>', 'Find clusters near a query')
  .option('--show', 'Show visual representation')
  .action(neuralCommands.cluster)

program
  .command('related [id]')
  .alias('neighbors')
  .description('Find semantically related items (interactive if no ID)')
  .option('-l, --limit <number>', 'Number of results', '10')
  .option('-r, --radius <number>', 'Semantic radius', '0.3')
  .option('--with-scores', 'Include similarity scores')
  .option('--with-edges', 'Include connections')
  .action(neuralCommands.related)

program
  .command('hierarchy [id]')
  .alias('tree')
  .description('Show semantic hierarchy for an item (interactive if no ID)')
  .option('-d, --depth <number>', 'Hierarchy depth', '3')
  .option('--parents-only', 'Show only parent hierarchy')
  .option('--children-only', 'Show only child hierarchy')
  .action(neuralCommands.hierarchy)

program
  .command('path <from> <to>')
  .description('Find semantic path between items')
  .option('--steps', 'Show step-by-step path')
  .option('--max-hops <number>', 'Maximum path length', '5')
  .action(() => {
    console.log(chalk.yellow('\n⚠️  Semantic path finding coming soon'))
    console.log(chalk.dim('This feature requires implementing graph traversal algorithms'))
    console.log(chalk.dim('Use "brainy neighbors" and "brainy hierarchy" to explore connections'))
  })

program
  .command('outliers')
  .alias('anomalies')
  .description('Detect semantic outliers')
  .option('-t, --threshold <number>', 'Outlier threshold', '0.3')
  .option('--explain', 'Explain why items are outliers')
  .action(neuralCommands.outliers)

program
  .command('visualize')
  .alias('viz')
  .description('Generate visualization data')
  .option('-f, --format <format>', 'Output format (json|d3|graphml)', 'json')
  .option('--max-nodes <number>', 'Maximum nodes', '500')
  .option('--dimensions <number>', '2D or 3D', '2')
  .option('-o, --output <file>', 'Output file')
  .action(neuralCommands.visualize)

// ===== VFS Commands (Subcommand Group) =====

program
  .command('vfs')
  .description('📁 Virtual File System operations')
  .addCommand(
    new Command('read')
      .argument('<path>', 'File path')
      .description('Read file from VFS')
      .option('-o, --output <file>', 'Save to local file')
      .option('--encoding <encoding>', 'File encoding', 'utf-8')
      .action((path, options) => {
        vfsCommands.read(path, options)
      })
  )
  .addCommand(
    new Command('write')
      .argument('<path>', 'File path')
      .description('Write file to VFS')
      .option('-c, --content <content>', 'File content')
      .option('-f, --file <file>', 'Read from local file')
      .option('--encoding <encoding>', 'File encoding', 'utf-8')
      .action((path, options) => {
        vfsCommands.write(path, options)
      })
  )
  .addCommand(
    new Command('ls')
      .alias('list')
      .argument('<path>', 'Directory path')
      .description('List directory contents')
      .option('-l, --long', 'Long format with details')
      .option('-a, --all', 'Show hidden files')
      .action((path, options) => {
        vfsCommands.ls(path, options)
      })
  )
  .addCommand(
    new Command('stat')
      .argument('<path>', 'File/directory path')
      .description('Get file/directory statistics')
      .action((path, options) => {
        vfsCommands.stat(path, options)
      })
  )
  .addCommand(
    new Command('mkdir')
      .argument('<path>', 'Directory path')
      .description('Create directory')
      .option('-p, --parents', 'Create parent directories')
      .action((path, options) => {
        vfsCommands.mkdir(path, options)
      })
  )
  .addCommand(
    new Command('rm')
      .argument('<path>', 'File/directory path')
      .description('Remove file or directory')
      .option('-r, --recursive', 'Remove recursively')
      .option('-f, --force', 'Force removal')
      .action((path, options) => {
        vfsCommands.rm(path, options)
      })
  )
  .addCommand(
    new Command('search')
      .argument('<query>', 'Search query')
      .description('Search files by content')
      .option('--path <path>', 'Search within path')
      .option('-l, --limit <number>', 'Max results', '10')
      .option('--type <type>', 'File type filter')
      .action((query, options) => {
        vfsCommands.search(query, options)
      })
  )
  .addCommand(
    new Command('similar')
      .argument('<path>', 'File path')
      .description('Find similar files')
      .option('-l, --limit <number>', 'Max results', '10')
      .option('-t, --threshold <number>', 'Similarity threshold', '0.7')
      .action((path, options) => {
        vfsCommands.similar(path, options)
      })
  )
  .addCommand(
    new Command('tree')
      .argument('<path>', 'Directory path')
      .description('Show directory tree')
      .option('-d, --depth <number>', 'Max depth', '3')
      .action((path, options) => {
        vfsCommands.tree(path, options)
      })
  )
  .addCommand(
    new Command('import')
      .argument('[source]', 'File or directory to import')
      .description('Import files/directories into VFS (interactive if no source)')
      .option('--target <path>', 'VFS target path', '/')
      .option('--recursive', 'Import directories recursively', true)
      .option('--generate-embeddings', 'Generate file embeddings', true)
      .option('--extract-metadata', 'Extract file metadata', true)
      .option('--skip-hidden', 'Skip hidden files')
      .option('--skip-node-modules', 'Skip node_modules', true)
      .option('--batch-size <number>', 'Batch size', '100')
      .option('--progress', 'Show progress')
      .action((source, options) => {
        importCommands.vfsImport(source, options)
      })
  )

// ===== VFS Commands (Backward Compatibility - Deprecated) =====

program
  .command('vfs-read <path>')
  .description('[DEPRECATED] Use: brainy vfs read <path>')
  .option('-o, --output <file>', 'Save to local file')
  .option('--encoding <encoding>', 'File encoding', 'utf-8')
  .action((path, options) => {
    console.log(chalk.yellow('⚠️  Command "vfs-read" is deprecated. Use: brainy vfs read'))
    vfsCommands.read(path, options)
  })

program
  .command('vfs-write <path>')
  .description('[DEPRECATED] Use: brainy vfs write <path>')
  .option('-c, --content <content>', 'File content')
  .option('-f, --file <file>', 'Read from local file')
  .option('--encoding <encoding>', 'File encoding', 'utf-8')
  .action((path, options) => {
    console.log(chalk.yellow('⚠️  Command "vfs-write" is deprecated. Use: brainy vfs write'))
    vfsCommands.write(path, options)
  })

program
  .command('vfs-ls <path>')
  .alias('vfs-list')
  .description('[DEPRECATED] Use: brainy vfs ls <path>')
  .option('-l, --long', 'Long format with details')
  .option('-a, --all', 'Show hidden files')
  .action((path, options) => {
    console.log(chalk.yellow('⚠️  Command "vfs-ls" is deprecated. Use: brainy vfs ls'))
    vfsCommands.ls(path, options)
  })

program
  .command('vfs-stat <path>')
  .description('[DEPRECATED] Use: brainy vfs stat <path>')
  .action((path, options) => {
    console.log(chalk.yellow('⚠️  Command "vfs-stat" is deprecated. Use: brainy vfs stat'))
    vfsCommands.stat(path, options)
  })

program
  .command('vfs-mkdir <path>')
  .description('[DEPRECATED] Use: brainy vfs mkdir <path>')
  .option('-p, --parents', 'Create parent directories')
  .action((path, options) => {
    console.log(chalk.yellow('⚠️  Command "vfs-mkdir" is deprecated. Use: brainy vfs mkdir'))
    vfsCommands.mkdir(path, options)
  })

program
  .command('vfs-rm <path>')
  .description('[DEPRECATED] Use: brainy vfs rm <path>')
  .option('-r, --recursive', 'Remove recursively')
  .option('-f, --force', 'Force removal')
  .action((path, options) => {
    console.log(chalk.yellow('⚠️  Command "vfs-rm" is deprecated. Use: brainy vfs rm'))
    vfsCommands.rm(path, options)
  })

program
  .command('vfs-search <query>')
  .description('[DEPRECATED] Use: brainy vfs search <query>')
  .option('--path <path>', 'Search within path')
  .option('-l, --limit <number>', 'Max results', '10')
  .option('--type <type>', 'File type filter')
  .action((query, options) => {
    console.log(chalk.yellow('⚠️  Command "vfs-search" is deprecated. Use: brainy vfs search'))
    vfsCommands.search(query, options)
  })

program
  .command('vfs-similar <path>')
  .description('[DEPRECATED] Use: brainy vfs similar <path>')
  .option('-l, --limit <number>', 'Max results', '10')
  .option('-t, --threshold <number>', 'Similarity threshold', '0.7')
  .action((path, options) => {
    console.log(chalk.yellow('⚠️  Command "vfs-similar" is deprecated. Use: brainy vfs similar'))
    vfsCommands.similar(path, options)
  })

program
  .command('vfs-tree <path>')
  .description('[DEPRECATED] Use: brainy vfs tree <path>')
  .option('-d, --depth <number>', 'Max depth', '3')
  .action((path, options) => {
    console.log(chalk.yellow('⚠️  Command "vfs-tree" is deprecated. Use: brainy vfs tree'))
    vfsCommands.tree(path, options)
  })

// ===== Storage Management Commands =====

program
  .command('storage')
  .description('💾 Storage management and cost optimization')
  .addCommand(
    new Command('status')
      .description('Show storage status and health')
      .option('--detailed', 'Show detailed information')
      .option('--quota', 'Show quota information (OPFS)')
      .action((options) => {
        storageCommands.status(options)
      })
  )
  .addCommand(
    new Command('lifecycle')
      .description('Lifecycle policy management')
      .addCommand(
        new Command('set')
          .argument('[config-file]', 'Policy configuration file (JSON)')
          .description('Set lifecycle policy (interactive if no file)')
          .option('--validate', 'Validate before applying')
          .action((configFile, options) => {
            storageCommands.lifecycle.set(configFile, options)
          })
      )
      .addCommand(
        new Command('get')
          .description('Get current lifecycle policy')
          .option('-f, --format <type>', 'Output format (json|yaml)', 'json')
          .action((options) => {
            storageCommands.lifecycle.get(options)
          })
      )
      .addCommand(
        new Command('remove')
          .description('Remove lifecycle policy')
          .action((options) => {
            storageCommands.lifecycle.remove(options)
          })
      )
  )
  .addCommand(
    new Command('compression')
      .description('Compression management (FileSystem)')
      .addCommand(
        new Command('enable')
          .description('Enable gzip compression')
          .action((options) => {
            storageCommands.compression.enable(options)
          })
      )
      .addCommand(
        new Command('disable')
          .description('Disable compression')
          .action((options) => {
            storageCommands.compression.disable(options)
          })
      )
      .addCommand(
        new Command('status')
          .description('Show compression status')
          .action((options) => {
            storageCommands.compression.status(options)
          })
      )
  )
  .addCommand(
    new Command('batch-delete')
      .argument('<file>', 'File containing entity IDs (one per line)')
      .description('Batch delete with retry logic')
      .option('--max-retries <n>', 'Maximum retry attempts', '3')
      .option('--continue-on-error', 'Continue if some deletes fail')
      .action((file, options) => {
        storageCommands.batchDelete(file, options)
      })
  )
  .addCommand(
    new Command('cost-estimate')
      .description('Estimate cloud storage costs')
      .option('--provider <type>', 'Cloud provider (aws|gcs|azure|r2)')
      .option('--size <gb>', 'Data size in GB')
      .option('--operations <n>', 'Monthly operations')
      .action((options) => {
        storageCommands.costEstimate(options)
      })
  )

// ===== Data Management Commands =====


program
program
  .command('data-stats')
  .description('Show detailed database statistics')
  .action(dataCommands.stats)

// ===== Inspect Commands =====
// Out-of-process diagnostics. Every subcommand opens the store via
// Brainy.openReadOnly() so a live writer can keep running. `--fresh`
// (default) asks the writer to flush before opening.

program
  .command('inspect')
  .description('🔍 Out-of-process diagnostics on a Brainy data directory')
  .addCommand(
    new Command('stats')
      .argument('<path>', 'Path to the Brainy data directory')
      .description('Counts, mode, indexed fields, writer lock info')
      .option('--no-fresh', 'Skip the writer flush request (faster, but state may be slightly stale)')
      .option('--json', 'Output as JSON')
      .option('--pretty', 'Pretty-print JSON')
      .action((path, options) => inspectCommands.stats(path, options))
  )
  .addCommand(
    new Command('find')
      .argument('<path>', 'Path to the Brainy data directory')
      .description('Find entities matching a where-clause filter')
      .option('--type <type>', 'Filter by entity type')
      .option('--where <json>', 'Metadata filter (JSON object)')
      .option('--limit <n>', 'Max results', '20')
      .option('--offset <n>', 'Skip N results (pagination)')
      .option('--no-fresh', 'Skip the writer flush request')
      .option('--json', 'Output as JSON')
      .option('--pretty', 'Pretty-print JSON')
      .action((path, options) => inspectCommands.find(path, options))
  )
  .addCommand(
    new Command('get')
      .argument('<path>', 'Path to the Brainy data directory')
      .argument('<id>', 'Entity ID')
      .description('Fetch a single entity by ID')
      .option('--no-fresh', 'Skip the writer flush request')
      .option('--json', 'Output as JSON')
      .option('--pretty', 'Pretty-print JSON')
      .action((path, id, options) => inspectCommands.get(path, id, options))
  )
  .addCommand(
    new Command('relations')
      .argument('<path>', 'Path to the Brainy data directory')
      .argument('<id>', 'Entity ID')
      .description('Show inbound/outbound relationships for an entity')
      .option('--direction <dir>', 'in | out | both', 'both')
      .option('--type <type>', 'Filter by verb type')
      .option('--limit <n>', 'Max relationships', '50')
      .option('--no-fresh', 'Skip the writer flush request')
      .option('--json', 'Output as JSON')
      .option('--pretty', 'Pretty-print JSON')
      .action((path, id, options) => inspectCommands.relations(path, id, options))
  )
  .addCommand(
    new Command('explain')
      .argument('<path>', 'Path to the Brainy data directory')
      .description('Show which index path will serve each where-clause field (column-store / sparse / none)')
      .option('--type <type>', 'Filter by entity type')
      .option('--where <json>', 'Metadata filter to plan (JSON object)')
      .option('--no-fresh', 'Skip the writer flush request')
      .option('--json', 'Output as JSON')
      .option('--pretty', 'Pretty-print JSON')
      .action((path, options) => inspectCommands.explain(path, options))
  )
  .addCommand(
    new Command('health')
      .argument('<path>', 'Path to the Brainy data directory')
      .description('Run invariant checks (index parity, field registry, _seeded sweep, writer heartbeat)')
      .option('--no-fresh', 'Skip the writer flush request')
      .option('--json', 'Output as JSON')
      .option('--pretty', 'Pretty-print JSON')
      .action((path, options) => inspectCommands.health(path, options))
  )
  .addCommand(
    new Command('sample')
      .argument('<path>', 'Path to the Brainy data directory')
      .description('Random N-entity sample')
      .option('--type <type>', 'Filter by entity type')
      .option('--n <n>', 'Sample size', '10')
      .option('--no-fresh', 'Skip the writer flush request')
      .option('--json', 'Output as JSON')
      .option('--pretty', 'Pretty-print JSON')
      .action((path, options) => inspectCommands.sample(path, options))
  )
  .addCommand(
    new Command('fields')
      .argument('<path>', 'Path to the Brainy data directory')
      .description('List indexed metadata fields')
      .option('--no-fresh', 'Skip the writer flush request')
      .option('--json', 'Output as JSON')
      .option('--pretty', 'Pretty-print JSON')
      .action((path, options) => inspectCommands.fields(path, options))
  )
  .addCommand(
    new Command('dump')
      .argument('<path>', 'Path to the Brainy data directory')
      .description('Dump all entities of a type as JSONL (one per line) to stdout')
      .option('--type <type>', 'Filter by entity type')
      .option('--batch <n>', 'Page size', '500')
      .option('--no-fresh', 'Skip the writer flush request')
      .action((path, options) => inspectCommands.dump(path, options))
  )
  .addCommand(
    new Command('watch')
      .argument('<path>', 'Path to the Brainy data directory')
      .description('Tail newly-written entities')
      .option('--type <type>', 'Filter by entity type')
      .option('--interval <ms>', 'Poll interval', '1000')
      .action((path, options) => inspectCommands.watch(path, options))
  )
  .addCommand(
    new Command('backup')
      .argument('<path>', 'Path to the Brainy data directory')
      .argument('<dest>', 'Destination tarball')
      .description('Atomic flush-then-tar snapshot of the data directory')
      .action((path, dest, options) => inspectCommands.backup(path, dest, options))
  )
  .addCommand(
    new Command('repair')
      .argument('<path>', 'Path to the Brainy data directory')
      .description('Rebuild indexes from raw storage (writer-mode — stop the live writer first)')
      .option('--force', 'Override the writer lock if you are sure no other writer is running')
      .option('--json', 'Output as JSON')
      .option('--pretty', 'Pretty-print JSON')
      .action((path, options) => inspectCommands.repair(path, options))
  )
  .addCommand(
    new Command('diff')
      .argument('<pathA>', 'First Brainy data directory')
      .argument('<pathB>', 'Second Brainy data directory')
      .description('Compare counts and a sample of entity IDs between two stores')
      .option('--sample <n>', 'Sample size per side', '100')
      .option('--json', 'Output as JSON')
      .option('--pretty', 'Pretty-print JSON')
      .action((pathA, pathB, options) => inspectCommands.diff(pathA, pathB, options))
  )

// ===== NLP Commands =====

program
  .command('extract [text]')
  .description('Extract entities from text using neural NLP (interactive if no text)')
  .action(nlpCommands.extract)

program
  .command('extract-concepts [text]')
  .description('Extract concepts from text with neural analysis (interactive if no text)')
  .option('--threshold <n>', 'Minimum confidence threshold (0-1)', '0.5')
  .action(nlpCommands.extractConcepts)

program
  .command('analyze [text]')
  .description('Full NLP analysis: entities, sentiment, topics (interactive if no text)')
  .action(nlpCommands.analyze)

// ===== Insights & Analytics Commands =====

program
  .command('insights')
  .description('Get comprehensive database insights and analytics')
  .action(insightsCommands.insights)

program
  .command('fields')
  .description('List all metadata fields with statistics')
  .action(insightsCommands.fields)

program
  .command('field-values [field]')
  .description('Get all values for a specific metadata field (interactive if no field)')
  .option('--limit <n>', 'Limit number of values shown', '100')
  .action(insightsCommands.fieldValues)

program
  .command('query-plan')
  .description('Get optimal query plan for filters')
  .option('--filters <json>', 'Filter JSON to analyze')
  .action(insightsCommands.queryPlan)

// ===== Utility Commands =====

program
  .command('stats')
  .alias('statistics')
  .description('Show quick database statistics')
  .option('--by-service', 'Group by service')
  .option('--detailed', 'Show detailed stats')
  .action(utilityCommands.stats)

program
  .command('clean')
  .description('Clean and optimize database')
  .option('--remove-orphans', 'Remove orphaned items')
  .option('--rebuild-index', 'Rebuild search index')
  .action(utilityCommands.clean)

program
  .command('benchmark')
  .alias('bench')
  .description('Run performance benchmarks')
  .option('--operations <ops>', 'Operations to benchmark', 'all')
  .option('--iterations <n>', 'Number of iterations', '100')
  .action(utilityCommands.benchmark)

// ===== COW Commands - Instant Fork & Branching =====

program
  .command('fork [name]')
  .description('🚀 Fork the brain (instant clone in 1-2 seconds)')
  .option('--message <msg>', 'Commit message')
  .option('--author <name>', 'Author name')
  .action(cowCommands.fork)

program
  .command('branch')
  .description('🌿 Branch management')
  .addCommand(
    new Command('list')
      .alias('ls')
      .description('List all branches/forks')
      .action((options) => {
        cowCommands.branchList(options)
      })
  )
  .addCommand(
    new Command('delete')
      .alias('rm')
      .argument('[name]', 'Branch name to delete')
      .description('Delete a branch/fork')
      .option('-f, --force', 'Skip confirmation')
      .action((name, options) => {
        cowCommands.branchDelete(name, options)
      })
  )

program
  .command('checkout [branch]')
  .alias('co')
  .description('Switch to a different branch')
  .action(cowCommands.checkout)

program
  .command('history')
  .alias('log')
  .description('Show commit history')
  .option('-l, --limit <number>', 'Number of commits to show', '10')
  .action(cowCommands.history)

program
  .command('migrate')
  .description('🔄 Migrate from v4.x to v5.0.0 (one-time)')
  .option('--from <path>', 'Old Brainy data path (v4.x)')
  .option('--to <path>', 'New Brainy data path (v5.0.0)')
  .option('--backup', 'Create backup before migration')
  .option('--dry-run', 'Show migration plan without executing')
  .action(cowCommands.migrate)

// ===== Interactive Mode =====

program
  .command('interactive')
  .alias('i')
  .description('Start interactive REPL mode')
  .action(async () => {
    const { startInteractiveMode } = await import('./interactive.js')
    await startInteractiveMode()
  })

// ===== Error Handling =====

program.exitOverride()

try {
  await program.parseAsync(process.argv)
} catch (error: any) {
  if (error.code === 'commander.helpDisplayed') {
    process.exit(0)
  }
  
  console.error(chalk.red('Error:'), error.message)
  
  if (program.opts().verbose) {
    console.error(chalk.gray(error.stack))
  }
  
  process.exit(1)
}

// Handle no command
if (!process.argv.slice(2).length) {
  program.outputHelp()
}