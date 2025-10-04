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
  .description('🧠 Enterprise Neural Intelligence Database')
  .version(version)
  .option('-v, --verbose', 'Verbose output')
  .option('--json', 'JSON output format')
  .option('--pretty', 'Pretty JSON output')
  .option('--no-color', 'Disable colored output')

// ===== Core Commands =====

program
  .command('add <text>')
  .description('Add text or JSON to the neural database')
  .option('-i, --id <id>', 'Specify custom ID')
  .option('-m, --metadata <json>', 'Add metadata')
  .option('-t, --type <type>', 'Specify noun type')
  .action(coreCommands.add)

program
  .command('find <query>')
  .description('Simple NLP search (just like code: brain.find("query"))')
  .option('-k, --limit <number>', 'Number of results', '10')
  .action(coreCommands.search)

program
  .command('search <query>')
  .description('Advanced search with Triple Intelligence™ (vector + graph + field)')
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
  .command('get <id>')
  .description('Get item by ID')
  .option('--with-connections', 'Include connections')
  .action(coreCommands.get)

program
  .command('relate <source> <verb> <target>')
  .description('Create a relationship between items')
  .option('-w, --weight <number>', 'Relationship weight')
  .option('-m, --metadata <json>', 'Relationship metadata')
  .action(coreCommands.relate)

program
  .command('import <file>')
  .description('Import data from file')
  .option('-f, --format <format>', 'Input format (json|csv|jsonl)', 'json')
  .option('--batch-size <number>', 'Batch size for import', '100')
  .action(coreCommands.import)

program
  .command('export [file]')
  .description('Export database')
  .option('-f, --format <format>', 'Output format (json|csv|jsonl)', 'json')
  .action(coreCommands.export)

// ===== Neural Commands =====

program
  .command('similar <a> <b>')
  .alias('sim')
  .description('Calculate similarity between two items')
  .option('--explain', 'Show detailed explanation')
  .option('--breakdown', 'Show similarity breakdown')
  .action(neuralCommands.similar)

program
  .command('cluster')
  .alias('clusters')
  .description('Find semantic clusters in the data')
  .option('--algorithm <type>', 'Clustering algorithm (hierarchical|kmeans|dbscan)', 'hierarchical')
  .option('--threshold <number>', 'Similarity threshold', '0.7')
  .option('--min-size <number>', 'Minimum cluster size', '2')
  .option('--max-clusters <number>', 'Maximum number of clusters')
  .option('--near <query>', 'Find clusters near a query')
  .option('--show', 'Show visual representation')
  .action(neuralCommands.cluster)

program
  .command('related <id>')
  .alias('neighbors')
  .description('Find semantically related items')
  .option('-l, --limit <number>', 'Number of results', '10')
  .option('-r, --radius <number>', 'Semantic radius', '0.3')
  .option('--with-scores', 'Include similarity scores')
  .option('--with-edges', 'Include connections')
  .action(neuralCommands.related)

program
  .command('hierarchy <id>')
  .alias('tree')
  .description('Show semantic hierarchy for an item')
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