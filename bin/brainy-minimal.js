#!/usr/bin/env node

/**
 * Brainy CLI - Minimal Version (Conversation Commands Only)
 *
 * This is a temporary minimal CLI that only includes working conversation commands
 * Full CLI will be restored in version 3.20.0
 */

import { Command } from 'commander'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))

const program = new Command()

program
  .name('brainy')
  .description('🧠 Brainy - Infinite Agent Memory')
  .version(packageJson.version)

// Dynamically load conversation command
const conversationCommand = await import('../dist/cli/commands/conversation.js').then(m => m.default)

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
    new Command('remove')
      .description('Remove MCP server and clean up')
      .action(async () => {
        await conversationCommand.handler({ action: 'remove', _: [] })
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
        await conversationCommand.handler({ action: 'search', ...options, _: [] })
      })
  )
  .addCommand(
    new Command('context')
      .description('Get relevant context for a query')
      .requiredOption('-q, --query <query>', 'Context query')
      .option('-l, --limit <number>', 'Maximum messages', '10')
      .action(async (options) => {
        await conversationCommand.handler({ action: 'context', ...options, _: [] })
      })
  )
  .addCommand(
    new Command('thread')
      .description('Get full conversation thread')
      .requiredOption('-c, --conversation-id <id>', 'Conversation ID')
      .action(async (options) => {
        await conversationCommand.handler({ action: 'thread', ...options, _: [] })
      })
  )
  .addCommand(
    new Command('stats')
      .description('Show conversation statistics')
      .action(async () => {
        await conversationCommand.handler({ action: 'stats', _: [] })
      })
  )

program.parse(process.argv)