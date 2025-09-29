#!/usr/bin/env node

/**
 * Brainy CLI - Enterprise Neural Intelligence System
 * 
 * Full TypeScript implementation with type safety and shared code
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { Brainy } from '../brainy.js'
import { neuralCommands } from './commands/neural.js'
import { coreCommands } from './commands/core.js'
import { utilityCommands } from './commands/utility.js'
import conversationCommand from './commands/conversation.js'
import { version } from '../package.json'

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
  .command('search <query>')
  .description('Search the neural database')
  .option('-k, --limit <number>', 'Number of results', '10')
  .option('-t, --threshold <number>', 'Similarity threshold')
  .option('--metadata <json>', 'Filter by metadata')
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
  .description('Find semantic path between items')
  .option('--steps', 'Show step-by-step path')
  .option('--max-hops <number>', 'Maximum path length', '5')
  .action(neuralCommands.path)

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

// ===== Conversation Commands (Infinite Memory) =====

program
  .command('conversation')
  .alias('conv')
  .description('💬 Infinite agent memory and context management')
  .addCommand(
    new Command('setup')
      .description('Set up MCP server for Claude Code integration')
      .action(async () => {
        await conversationCommand.handler({ action: 'setup', _: [] })
      })
  )
  .addCommand(
    new Command('search')
      .description('Search messages across conversations')
      .requiredOption('-q, --query <query>', 'Search query')
      .option('-c, --conversation-id <id>', 'Filter by conversation')
      .option('-r, --role <role>', 'Filter by role')
      .option('-l, --limit <number>', 'Maximum results', '10')
      .action(async (options) => {
        await conversationCommand.handler({ action: 'search', ...options as any, _: [] })
      })
  )
  .addCommand(
    new Command('context')
      .description('Get relevant context for a query')
      .requiredOption('-q, --query <query>', 'Context query')
      .option('-l, --limit <number>', 'Maximum messages', '10')
      .action(async (options) => {
        await conversationCommand.handler({ action: 'context', ...options as any, _: [] })
      })
  )
  .addCommand(
    new Command('thread')
      .description('Get full conversation thread')
      .requiredOption('-c, --conversation-id <id>', 'Conversation ID')
      .action(async (options) => {
        await conversationCommand.handler({ action: 'thread', ...options as any, _: [] })
      })
  )
  .addCommand(
    new Command('stats')
      .description('Show conversation statistics')
      .action(async () => {
        await conversationCommand.handler({ action: 'stats', _: [] })
      })
  )

// ===== Utility Commands =====

program
  .command('stats')
  .alias('statistics')
  .description('Show database statistics')
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