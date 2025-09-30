/**
 * 💬 Conversation CLI Commands
 *
 * CLI interface for infinite agent memory and conversation management
 */

import inquirer from 'inquirer'
import chalk from 'chalk'
import ora from 'ora'
import * as fs from '../../universal/fs.js'
import * as path from '../../universal/path.js'
import { Brainy } from '../../brainy.js'

interface CommandArguments {
  action?: string
  conversationId?: string
  query?: string
  role?: string
  limit?: number
  format?: string
  output?: string
  _: string[]
}

export const conversationCommand = {
  command: 'conversation [action]',
  describe: '💬 Conversation and context management',

  builder: (yargs: any) => {
    return yargs
      .positional('action', {
        describe: 'Conversation operation to perform',
        type: 'string',
        choices: ['setup', 'remove', 'search', 'context', 'thread', 'stats', 'export', 'import']
      })
      .option('conversation-id', {
        describe: 'Conversation ID',
        type: 'string',
        alias: 'c'
      })
      .option('query', {
        describe: 'Search query or context query',
        type: 'string',
        alias: 'q'
      })
      .option('role', {
        describe: 'Filter by message role',
        type: 'string',
        choices: ['user', 'assistant', 'system', 'tool'],
        alias: 'r'
      })
      .option('limit', {
        describe: 'Maximum results',
        type: 'number',
        default: 10,
        alias: 'l'
      })
      .option('format', {
        describe: 'Output format',
        type: 'string',
        choices: ['json', 'table', 'text'],
        default: 'table',
        alias: 'f'
      })
      .option('output', {
        describe: 'Output file path',
        type: 'string',
        alias: 'o'
      })
      .example('$0 conversation setup', 'Set up MCP server for Claude Code')
      .example('$0 conversation search -q "authentication" -l 5', 'Search messages')
      .example('$0 conversation context -q "how to implement JWT"', 'Get relevant context')
      .example('$0 conversation thread -c conv_123', 'Get conversation thread')
      .example('$0 conversation stats', 'Show conversation statistics')
  },

  handler: async (argv: CommandArguments) => {
    const action = argv.action || 'setup'

    try {
      switch (action) {
        case 'setup':
          await handleSetup(argv)
          break
        case 'remove':
          await handleRemove(argv)
          break
        case 'search':
          await handleSearch(argv)
          break
        case 'context':
          await handleContext(argv)
          break
        case 'thread':
          await handleThread(argv)
          break
        case 'stats':
          await handleStats(argv)
          break
        case 'export':
          await handleExport(argv)
          break
        case 'import':
          await handleImport(argv)
          break
        default:
          console.log(chalk.yellow(`Unknown action: ${action}`))
          console.log('Run "brainy conversation --help" for usage information')
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`))
      process.exit(1)
    }
  }
}

/**
 * Handle setup command - Set up MCP server for Claude Code
 */
async function handleSetup(argv: CommandArguments) {
  console.log(chalk.bold.cyan('\n🧠 Brainy Infinite Memory Setup\n'))

  // Check for existing setup
  const homeDir = process.env.HOME || process.env.USERPROFILE || '~'
  const brainyDir = path.join(homeDir, '.brainy-memory')
  const dataDir = path.join(brainyDir, 'data')
  const serverPath = path.join(brainyDir, 'mcp-server.js')
  const configPath = path.join(homeDir, '.config', 'claude-code', 'mcp-servers.json')

  // Check if already set up
  if (await fs.exists(brainyDir)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Brainy memory setup already exists. Overwrite?',
        default: false
      }
    ])

    if (!overwrite) {
      console.log(chalk.yellow('Setup cancelled'))
      return
    }
  }

  const spinner = ora('Creating Brainy memory directory...').start()

  try {
    // Create directories
    await fs.mkdir(brainyDir, { recursive: true })
    await fs.mkdir(dataDir, { recursive: true })

    spinner.succeed('Created Brainy memory directory')

    // Create MCP server script
    spinner.start('Creating MCP server script...')

    const serverScript = `#!/usr/bin/env node

/**
 * Brainy Infinite Memory MCP Server
 *
 * This server provides conversation and context management
 * for Claude Code through the Model Control Protocol (MCP).
 */

import { Brainy } from '@soulcraft/brainy'
import { BrainyMCPService } from '@soulcraft/brainy'
import { MCPConversationToolset } from '@soulcraft/brainy'

async function main() {
  try {
    // Initialize Brainy with filesystem storage
    const brain = new Brainy({
      storage: {
        type: 'filesystem',
        path: '${dataDir.replace(/\\/g, '/')}'
      },
      silent: true // Suppress console output
    })

    await brain.init()

    // Create MCP service
    const mcpService = new BrainyMCPService(brain, {
      enableAuth: false // Local usage, no auth needed
    })

    // Create conversation toolset
    const conversationTools = new MCPConversationToolset(brain)
    await conversationTools.init()

    // Register conversation tools
    const tools = await conversationTools.getAvailableTools()

    console.error('🧠 Brainy Memory Server started')
    console.error(\`📊 \${tools.length} conversation tools available\`)
    console.error('✅ Ready for Claude Code integration')

    // Handle MCP requests via stdio
    process.stdin.on('data', async (data) => {
      try {
        const request = JSON.parse(data.toString())

        // Route conversation tool requests
        let response
        if (request.toolName && request.toolName.startsWith('conversation_')) {
          response = await conversationTools.handleRequest(request)
        } else {
          response = await mcpService.handleRequest(request)
        }

        // Write response to stdout
        process.stdout.write(JSON.stringify(response) + '\\n')
      } catch (error) {
        console.error('Error handling request:', error)
      }
    })

    // Handle shutdown gracefully
    process.on('SIGINT', () => {
      console.error('\\n🛑 Shutting down Brainy Memory Server')
      process.exit(0)
    })

  } catch (error) {
    console.error('Failed to start Brainy Memory Server:', error)
    process.exit(1)
  }
}

main()
`

    await fs.writeFile(serverPath, serverScript, 'utf8')
    // Make executable on Unix systems
    try {
      await import('fs').then(fsModule => {
        fsModule.promises.chmod(serverPath, 0o755).catch(() => {})
      })
    } catch {
      // Windows doesn't need chmod
    }
    spinner.succeed('Created MCP server script')

    // Create Claude Code config
    spinner.start('Configuring Claude Code...')

    const configDir = path.dirname(configPath)
    await fs.mkdir(configDir, { recursive: true })

    let mcpConfig: any = {}
    if (await fs.exists(configPath)) {
      const existingConfig = await fs.readFile(configPath, 'utf8')
      mcpConfig = JSON.parse(existingConfig)
    }

    mcpConfig['brainy-memory'] = {
      command: 'node',
      args: [serverPath],
      env: {
        NODE_ENV: 'production'
      }
    }

    await fs.writeFile(configPath, JSON.stringify(mcpConfig, null, 2), 'utf8')
    spinner.succeed('Configured Claude Code')

    // Initialize Brainy database
    spinner.start('Initializing Brainy database...')

    const brain = new Brainy({
      storage: {
        type: 'filesystem',
        options: {
          path: dataDir
        }
      },
      silent: true
    })
    await brain.init()

    spinner.succeed('Initialized Brainy database')

    // Shutdown Brainy to release resources
    await brain.close()

    // Success!
    console.log(chalk.bold.green('\n✅ Setup complete!\n'))
    console.log(chalk.cyan('📁 Memory storage:'), brainyDir)
    console.log(chalk.cyan('🔧 MCP server:'), serverPath)
    console.log(chalk.cyan('⚙️  Claude Code config:'), configPath)
    console.log()
    console.log(chalk.bold('🚀 Next steps:'))
    console.log('  1. Restart Claude Code to load the MCP server')
    console.log('  2. Start a new conversation - your history will be saved automatically!')
    console.log('  3. Claude will use past context to help you work faster')
    console.log()
    console.log(chalk.dim('Run "brainy conversation stats" to see your conversation statistics'))

  } catch (error: any) {
    spinner.fail('Setup failed')
    throw error
  }
}

/**
 * Handle remove command - Remove MCP server and optionally data
 */
async function handleRemove(argv: CommandArguments) {
  console.log(chalk.bold.cyan('\n🗑️  Brainy Infinite Memory Removal\n'))

  const homeDir = process.env.HOME || process.env.USERPROFILE || '~'
  const brainyDir = path.join(homeDir, '.brainy-memory')
  const configPath = path.join(homeDir, '.config', 'claude-code', 'mcp-servers.json')

  // Check if setup exists
  const brainyExists = await fs.exists(brainyDir)
  const configExists = await fs.exists(configPath)

  if (!brainyExists && !configExists) {
    console.log(chalk.yellow('No Brainy memory setup found. Nothing to remove.'))
    return
  }

  // Show what will be removed
  console.log(chalk.white('The following will be removed:'))
  if (brainyExists) {
    console.log(chalk.dim(`  • ${brainyDir} (memory data and MCP server)`))
  }
  if (configExists) {
    console.log(chalk.dim(`  • MCP config entry in ${configPath}`))
  }
  console.log()

  // Confirm removal
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to remove Brainy infinite memory?',
      default: false
    }
  ])

  if (!confirm) {
    console.log(chalk.yellow('Removal cancelled'))
    return
  }

  const spinner = ora('Removing Brainy memory setup...').start()

  try {
    // Remove Brainy directory
    if (brainyExists) {
      // Use Node.js fs for rm operation as universal fs doesn't have it
      const nodefs = await import('fs')
      await nodefs.promises.rm(brainyDir, { recursive: true, force: true })
      spinner.text = 'Removed memory directory...'
    }

    // Remove MCP config entry
    if (configExists) {
      try {
        const configContent = await fs.readFile(configPath, 'utf8')
        const mcpConfig = JSON.parse(configContent)

        if (mcpConfig['brainy-memory']) {
          delete mcpConfig['brainy-memory']
          await fs.writeFile(configPath, JSON.stringify(mcpConfig, null, 2), 'utf8')
          spinner.text = 'Removed MCP configuration...'
        }
      } catch (error) {
        // If config file is corrupted or empty, skip
        spinner.warn('Could not update MCP config file')
      }
    }

    spinner.succeed('Successfully removed Brainy infinite memory')

    console.log()
    console.log(chalk.bold('✅ Cleanup complete'))
    console.log()
    console.log(chalk.white('All conversation data and MCP configuration have been removed.'))
    console.log(chalk.dim('Run "brainy conversation setup" to set up again.'))
    console.log()

  } catch (error: any) {
    spinner.fail('Removal failed')
    console.error(chalk.red('Error:'), error.message)
    throw error
  }
}

/**
 * Handle search command - Search messages
 */
async function handleSearch(argv: CommandArguments) {
  if (!argv.query) {
    console.log(chalk.yellow('Query required. Use -q or --query'))
    return
  }

  const spinner = ora('Searching conversations...').start()

  const brain = new Brainy()
  await brain.init()

  const conv = brain.conversation()
  await conv.init()

  const results = await conv.searchMessages({
    query: argv.query,
    limit: argv.limit || 10,
    role: argv.role as any,
    includeContent: true,
    includeMetadata: true
  })

  spinner.succeed(`Found ${results.length} messages`)

  if (results.length === 0) {
    console.log(chalk.yellow('No messages found'))
    await brain.close()
    return
  }

  // Display results
  console.log()
  for (const result of results) {
    console.log(chalk.bold.cyan(`${result.message.role}:`), result.snippet)
    console.log(chalk.dim(`  Score: ${result.score.toFixed(3)} | Conv: ${result.conversationId}`))
    console.log()
  }

  await brain.close()
}

/**
 * Handle context command - Get relevant context
 */
async function handleContext(argv: CommandArguments) {
  if (!argv.query) {
    console.log(chalk.yellow('Query required. Use -q or --query'))
    return
  }

  const spinner = ora('Retrieving relevant context...').start()

  const brain = new Brainy()
  await brain.init()

  const conv = brain.conversation()
  await conv.init()

  const context = await conv.getRelevantContext(argv.query, {
    limit: argv.limit || 10,
    includeArtifacts: true,
    includeSimilarConversations: true
  })

  spinner.succeed(`Retrieved ${context.messages.length} relevant messages`)

  if (context.messages.length === 0) {
    console.log(chalk.yellow('No relevant context found'))
    await brain.close()
    return
  }

  // Display context
  console.log()
  console.log(chalk.bold('📊 Context Statistics:'))
  console.log(chalk.dim(`  Messages: ${context.messages.length}`))
  console.log(chalk.dim(`  Tokens: ${context.totalTokens}`))
  console.log(chalk.dim(`  Query time: ${context.metadata.queryTime}ms`))
  console.log()

  console.log(chalk.bold('💬 Relevant Messages:'))
  for (const msg of context.messages) {
    console.log()
    console.log(chalk.cyan(`${msg.role} (score: ${msg.relevanceScore.toFixed(3)}):`))
    console.log(msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : ''))
  }

  if (context.similarConversations && context.similarConversations.length > 0) {
    console.log()
    console.log(chalk.bold('🔗 Similar Conversations:'))
    for (const conv of context.similarConversations) {
      console.log(chalk.dim(`  - ${conv.title || conv.id} (${conv.relevance.toFixed(2)})`))
    }
  }

  await brain.close()
}

/**
 * Handle thread command - Get conversation thread
 */
async function handleThread(argv: CommandArguments) {
  if (!argv.conversationId) {
    console.log(chalk.yellow('Conversation ID required. Use -c or --conversation-id'))
    return
  }

  const spinner = ora('Loading conversation thread...').start()

  const brain = new Brainy()
  await brain.init()

  const conv = brain.conversation()
  await conv.init()

  const thread = await conv.getConversationThread(argv.conversationId, {
    includeArtifacts: true
  })

  spinner.succeed(`Loaded ${thread.messages.length} messages`)

  // Display thread
  console.log()
  console.log(chalk.bold('📊 Thread Information:'))
  console.log(chalk.dim(`  Conversation: ${thread.id}`))
  console.log(chalk.dim(`  Messages: ${thread.metadata.messageCount}`))
  console.log(chalk.dim(`  Tokens: ${thread.metadata.totalTokens}`))
  console.log(chalk.dim(`  Started: ${new Date(thread.metadata.startTime).toLocaleString()}`))
  console.log()

  console.log(chalk.bold('💬 Messages:'))
  for (const msg of thread.messages) {
    console.log()
    console.log(chalk.cyan(`${msg.role}:`), msg.content)
    console.log(chalk.dim(`  ${new Date(msg.createdAt).toLocaleString()}`))
  }

  await brain.close()
}

/**
 * Handle stats command - Show statistics
 */
async function handleStats(argv: CommandArguments) {
  const spinner = ora('Calculating statistics...').start()

  const brain = new Brainy()
  await brain.init()

  const conv = brain.conversation()
  await conv.init()

  const stats = await conv.getConversationStats()

  spinner.succeed('Statistics calculated')

  // Display stats
  console.log()
  console.log(chalk.bold.cyan('📊 Conversation Statistics\n'))
  console.log(chalk.bold('Overall:'))
  console.log(chalk.dim(`  Conversations: ${stats.totalConversations}`))
  console.log(chalk.dim(`  Messages: ${stats.totalMessages}`))
  console.log(chalk.dim(`  Total Tokens: ${stats.totalTokens.toLocaleString()}`))
  console.log(chalk.dim(`  Avg Messages/Conversation: ${stats.averageMessagesPerConversation.toFixed(1)}`))
  console.log(chalk.dim(`  Avg Tokens/Message: ${stats.averageTokensPerMessage.toFixed(1)}`))
  console.log()

  if (Object.keys(stats.roles).length > 0) {
    console.log(chalk.bold('By Role:'))
    for (const [role, count] of Object.entries(stats.roles)) {
      console.log(chalk.dim(`  ${role}: ${count}`))
    }
    console.log()
  }

  if (Object.keys(stats.phases).length > 0) {
    console.log(chalk.bold('By Phase:'))
    for (const [phase, count] of Object.entries(stats.phases)) {
      console.log(chalk.dim(`  ${phase}: ${count}`))
    }
  }

  await brain.close()
}

/**
 * Handle export command - Export conversation
 */
async function handleExport(argv: CommandArguments) {
  if (!argv.conversationId) {
    console.log(chalk.yellow('Conversation ID required. Use -c or --conversation-id'))
    return
  }

  const spinner = ora('Exporting conversation...').start()

  const brain = new Brainy()
  await brain.init()

  const conv = brain.conversation()
  await conv.init()

  const exported = await conv.exportConversation(argv.conversationId)

  const output = argv.output || `conversation_${argv.conversationId}.json`
  await fs.writeFile(output, JSON.stringify(exported, null, 2), 'utf8')

  spinner.succeed(`Exported to ${output}`)

  await brain.close()
}

/**
 * Handle import command - Import conversation
 */
async function handleImport(argv: CommandArguments) {
  const inputFile = argv.output
  if (!inputFile) {
    console.log(chalk.yellow('Input file required. Use -o or --output'))
    return
  }

  const spinner = ora('Importing conversation...').start()

  const brain = new Brainy()
  await brain.init()

  const conv = brain.conversation()
  await conv.init()

  const data = JSON.parse(await fs.readFile(inputFile, 'utf8'))
  const conversationId = await conv.importConversation(data)

  spinner.succeed(`Imported as conversation ${conversationId}`)

  await brain.close()
}

export default conversationCommand