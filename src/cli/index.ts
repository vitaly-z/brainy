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

  ${chalk.dim('# Storage management (v4.0.0)')}
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
  .description('Find semantic path between items (v3.21.0)')
  .option('--steps', 'Show step-by-step path')
  .option('--max-hops <number>', 'Maximum path length', '5')
  .action(() => {
    console.log(chalk.yellow('\n⚠️  Semantic path finding coming in v3.21.0'))
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

// ===== Storage Management Commands (v4.0.0) =====

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
  .command('backup <file>')
  .description('Create database backup')
  .option('--compress', 'Compress backup')
  .action(dataCommands.backup)

program
  .command('restore <file>')
  .description('Restore from backup')
  .option('--merge', 'Merge with existing data (default: replace)')
  .action(dataCommands.restore)

program
  .command('data-stats')
  .description('Show detailed database statistics')
  .action(dataCommands.stats)

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