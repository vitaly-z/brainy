#!/usr/bin/env node

/**
 * Brainy Interactive Mode
 * 
 * Professional, guided CLI experience for beginners
 */

import { program } from 'commander'
import { Brainy } from '../dist/index.js'
import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import Table from 'cli-table3'
import boxen from 'boxen'

// Professional color scheme
const colors = {
  primary: chalk.hex('#3A5F4A'),    // Teal (from logo)
  success: chalk.hex('#2D4A3A'),    // Deep teal
  info: chalk.hex('#4A6B5A'),       // Medium teal  
  warning: chalk.hex('#D67441'),    // Orange (from logo)
  error: chalk.hex('#B85C35'),      // Deep orange
  brain: chalk.hex('#D67441'),      // Brain orange
  cream: chalk.hex('#F5E6A3'),      // Cream background
  dim: chalk.dim,
  bold: chalk.bold,
  cyan: chalk.cyan,
  green: chalk.green,
  yellow: chalk.yellow,
  red: chalk.red
}

// Icons for consistent visual language
const icons = {
  brain: '🧠',
  search: '🔍',
  add: '➕',
  delete: '🗑️',
  update: '🔄',
  import: '📥',
  export: '📤',
  connect: '🔗',
  question: '❓',
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  sparkle: '✨',
  rocket: '🚀',
  thinking: '🤔',
  chat: '💬',
  stats: '📊',
  config: '⚙️',
  cloud: '☁️'
}

let brainyInstance = null

async function getBrainy() {
  if (!brainyInstance) {
    const spinner = ora('Initializing Brainy...').start()
    try {
      brainyInstance = new Brainy()
      await brainyInstance.init()
      spinner.succeed('Brainy initialized')
    } catch (error) {
      spinner.fail('Failed to initialize Brainy')
      console.error(colors.error(error.message))
      process.exit(1)
    }
  }
  return brainyInstance
}

/**
 * Professional welcome screen
 */
function showWelcome() {
  console.clear()
  
  const welcomeBox = boxen(
    colors.primary(`${icons.brain}  BRAINY - Neural Intelligence System\n`) +
    colors.dim('\nYour AI-Powered Second Brain\n') +
    colors.info('Version 1.6.0'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
      textAlignment: 'center'
    }
  )
  
  console.log(welcomeBox)
  console.log()
}

/**
 * Main interactive menu
 */
async function mainMenu() {
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: colors.cyan('What would you like to do?'),
    choices: [
      new inquirer.Separator(colors.dim('── Core Operations ──')),
      { name: `${icons.add}  Add data to your brain`, value: 'add' },
      { name: `${icons.search}  Search your knowledge`, value: 'search' },
      { name: `${icons.chat}  Chat with your data`, value: 'chat' },
      { name: `${icons.update}  Update existing data`, value: 'update' },
      { name: `${icons.delete}  Delete data`, value: 'delete' },
      
      new inquirer.Separator(colors.dim('── Advanced Features ──')),
      { name: `${icons.connect}  Create relationships`, value: 'relate' },
      { name: `${icons.import}  Import from file/URL`, value: 'import' },
      { name: `${icons.export}  Export your brain`, value: 'export' },
      { name: `${icons.brain}  Neural operations`, value: 'neural' },
      
      new inquirer.Separator(colors.dim('── System ──')),
      { name: `${icons.stats}  View statistics`, value: 'stats' },
      { name: `${icons.config}  Configuration`, value: 'config' },
      { name: `${icons.cloud}  Brain Cloud`, value: 'cloud' },
      { name: `${icons.info}  Help & Documentation`, value: 'help' },
      
      new inquirer.Separator(),
      { name: 'Exit', value: 'exit' }
    ],
    pageSize: 20
  }])
  
  return action
}

/**
 * Neural operations submenu
 */
async function neuralMenu() {
  const { operation } = await inquirer.prompt([{
    type: 'list',
    name: 'operation',
    message: colors.cyan('Select neural operation:'),
    choices: [
      { name: `${icons.brain}  Calculate similarity`, value: 'similar' },
      { name: `${icons.search}  Find clusters`, value: 'cluster' },
      { name: `${icons.connect}  Find related items`, value: 'related' },
      { name: `${icons.thinking}  Build hierarchy`, value: 'hierarchy' },
      { name: `${icons.rocket}  Find semantic path`, value: 'path' },
      { name: `${icons.warning}  Detect outliers`, value: 'outliers' },
      { name: `${icons.sparkle}  Generate visualization`, value: 'visualize' },
      new inquirer.Separator(),
      { name: '← Back to main menu', value: 'back' }
    ]
  }])
  
  return operation
}

/**
 * Execute commands with beautiful feedback
 */
async function executeCommand(command) {
  const brain = await getBrainy()
  
  switch (command) {
    case 'add':
      await interactiveAdd(brain)
      break
      
    case 'search':
      await interactiveSearch(brain)
      break
      
    case 'chat':
      await interactiveChat(brain)
      break
      
    case 'update':
      await interactiveUpdate(brain)
      break
      
    case 'delete':
      await interactiveDelete(brain)
      break
      
    case 'relate':
      await interactiveRelate(brain)
      break
      
    case 'import':
      await interactiveImport(brain)
      break
      
    case 'export':
      await interactiveExport(brain)
      break
      
    case 'neural':
      const neuralOp = await neuralMenu()
      if (neuralOp !== 'back') {
        await executeNeuralOperation(neuralOp, brain)
      }
      break
      
    case 'stats':
      await showStatistics(brain)
      break
      
    case 'config':
      await interactiveConfig(brain)
      break
      
    case 'cloud':
      await showCloudInfo()
      break
      
    case 'help':
      await showHelp()
      break
  }
}

/**
 * Interactive add with rich prompts
 */
async function interactiveAdd(brain) {
  console.log(colors.primary(`\n${icons.add} Add Data\n`))
  
  const { inputType } = await inquirer.prompt([{
    type: 'list',
    name: 'inputType',
    message: 'How would you like to add data?',
    choices: [
      { name: 'Type or paste text', value: 'text' },
      { name: 'Multi-line editor', value: 'editor' },
      { name: 'JSON object', value: 'json' },
      { name: 'Import from clipboard', value: 'clipboard' }
    ]
  }])
  
  let data = ''
  
  switch (inputType) {
    case 'text':
      const { text } = await inquirer.prompt([{
        type: 'input',
        name: 'text',
        message: 'Enter your data:',
        validate: input => input.trim() ? true : 'Please enter some data'
      }])
      data = text
      break
      
    case 'editor':
      const { editorText } = await inquirer.prompt([{
        type: 'editor',
        name: 'editorText',
        message: 'Enter your data (opens editor):',
        postfix: '.md'
      }])
      data = editorText
      break
      
    case 'json':
      const { jsonText } = await inquirer.prompt([{
        type: 'editor',
        name: 'jsonText',
        message: 'Enter JSON data:',
        postfix: '.json',
        default: '{\n  \n}',
        validate: input => {
          try {
            JSON.parse(input)
            return true
          } catch (e) {
            return `Invalid JSON: ${e.message}`
          }
        }
      }])
      data = jsonText
      break
  }
  
  // Optional metadata
  const { addMetadata } = await inquirer.prompt([{
    type: 'confirm',
    name: 'addMetadata',
    message: 'Would you like to add metadata?',
    default: false
  }])
  
  let metadata = {}
  if (addMetadata) {
    const { metadataJson } = await inquirer.prompt([{
      type: 'editor',
      name: 'metadataJson',
      message: 'Enter metadata (JSON):',
      postfix: '.json',
      default: '{\n  "type": "",\n  "tags": [],\n  "category": ""\n}',
      validate: input => {
        try {
          JSON.parse(input)
          return true
        } catch (e) {
          return `Invalid JSON: ${e.message}`
        }
      }
    }])
    metadata = JSON.parse(metadataJson)
  }
  
  const spinner = ora('Adding data...').start()
  try {
    const id = await brain.add(data, metadata)
    spinner.succeed(`Added successfully with ID: ${id}`)
    
    // Show summary
    console.log(boxen(
      colors.success(`${icons.success} Data added successfully!\n\n`) +
      colors.info(`ID: ${id}\n`) +
      colors.dim(`Size: ${data.length} characters\n`) +
      (Object.keys(metadata).length > 0 ? colors.dim(`Metadata: ${Object.keys(metadata).join(', ')}`) : ''),
      { padding: 1, borderColor: 'green', borderStyle: 'round' }
    ))
  } catch (error) {
    spinner.fail('Failed to add data')
    console.error(colors.error(error.message))
  }
}

/**
 * Interactive search with filters
 */
async function interactiveSearch(brain) {
  console.log(colors.primary(`\n${icons.search} Search\n`))
  
  const { query } = await inquirer.prompt([{
    type: 'input',
    name: 'query',
    message: 'Enter search query:',
    validate: input => input.trim() ? true : 'Please enter a search query'
  }])
  
  // Advanced options
  const { useFilters } = await inquirer.prompt([{
    type: 'confirm',
    name: 'useFilters',
    message: 'Apply filters?',
    default: false
  }])
  
  let searchOptions = { limit: 10 }
  
  if (useFilters) {
    const { limit, threshold } = await inquirer.prompt([
      {
        type: 'number',
        name: 'limit',
        message: 'Maximum results:',
        default: 10
      },
      {
        type: 'number',
        name: 'threshold',
        message: 'Similarity threshold (0-1):',
        default: 0.5,
        validate: input => input >= 0 && input <= 1 ? true : 'Must be between 0 and 1'
      }
    ])
    
    searchOptions.limit = limit
    searchOptions.threshold = threshold
  }
  
  const spinner = ora('Searching...').start()
  try {
    const results = await brain.search(query, searchOptions.limit, searchOptions)
    spinner.succeed(`Found ${results.length} results`)
    
    if (results.length === 0) {
      console.log(colors.warning('No results found'))
    } else {
      // Display results in a table
      const table = new Table({
        head: [colors.cyan('ID'), colors.cyan('Content'), colors.cyan('Score')],
        style: { head: [], border: [] },
        colWidths: [20, 50, 10]
      })
      
      results.forEach(result => {
        const content = result.content || result.id
        const truncated = content.length > 47 ? content.substring(0, 47) + '...' : content
        const score = result.score ? `${(result.score * 100).toFixed(1)}%` : 'N/A'
        
        table.push([
          result.id.substring(0, 18),
          truncated,
          colors.green(score)
        ])
      })
      
      console.log(table.toString())
      
      // Ask if user wants to see full details
      const { viewDetails } = await inquirer.prompt([{
        type: 'confirm',
        name: 'viewDetails',
        message: 'View full details of a result?',
        default: false
      }])
      
      if (viewDetails) {
        const { selectedId } = await inquirer.prompt([{
          type: 'list',
          name: 'selectedId',
          message: 'Select result:',
          choices: results.map(r => ({
            name: `${r.id} - ${r.content?.substring(0, 50)}...`,
            value: r.id
          }))
        }])
        
        const selected = results.find(r => r.id === selectedId)
        console.log(boxen(
          colors.cyan('Full Details\n\n') +
          colors.info(`ID: ${selected.id}\n\n`) +
          `Content:\n${selected.content}\n\n` +
          (selected.metadata ? `Metadata:\n${JSON.stringify(selected.metadata, null, 2)}` : ''),
          { padding: 1, borderColor: 'cyan', borderStyle: 'round' }
        ))
      }
    }
  } catch (error) {
    spinner.fail('Search failed')
    console.error(colors.error(error.message))
  }
}

/**
 * Show statistics with beautiful formatting
 */
async function showStatistics(brain) {
  const spinner = ora('Gathering statistics...').start()
  
  try {
    const stats = await brain.getStatistics()
    spinner.succeed('Statistics loaded')
    
    console.log(boxen(
      colors.primary(`${icons.stats} Database Statistics\n\n`) +
      colors.info(`Total Items: ${colors.bold(stats.total || 0)}\n`) +
      colors.info(`Nouns: ${stats.nounCount || 0}\n`) +
      colors.info(`Relationships: ${stats.verbCount || 0}\n`) +
      colors.info(`Metadata Records: ${stats.metadataCount || 0}\n\n`) +
      colors.dim(`Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`),
      { 
        padding: 1, 
        borderColor: 'blue', 
        borderStyle: 'round',
        textAlignment: 'left'
      }
    ))
  } catch (error) {
    spinner.fail('Failed to get statistics')
    console.error(colors.error(error.message))
  }
}

/**
 * Show help with examples
 */
async function showHelp() {
  console.log(boxen(
    colors.primary(`${icons.info} Brainy Help\n\n`) +
    colors.cyan('Common Commands:\n') +
    colors.dim(`
  brainy add "text"        Add data
  brainy search "query"    Search your brain
  brainy chat             Interactive AI chat
  brainy status           View statistics
  brainy help             This help menu
  
`) +
    colors.cyan('Interactive Mode:\n') +
    colors.dim(`
  brainy                  Start interactive mode
  brainy -i               Alternative interactive mode
  
`) +
    colors.cyan('Advanced Features:\n') +
    colors.dim(`
  brainy similar a b      Calculate similarity
  brainy cluster          Find semantic clusters
  brainy export           Export your data
  brainy cloud            Brain Cloud features
`),
    { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
  ))
  
  const { learnMore } = await inquirer.prompt([{
    type: 'confirm',
    name: 'learnMore',
    message: 'View detailed documentation?',
    default: false
  }])
  
  if (learnMore) {
    console.log(colors.info('\nDocumentation: https://github.com/TimeSoul/brainy'))
    console.log(colors.info('Enterprise features: Coming in future releases'))
  }
}

/**
 * Main interactive loop
 */
async function main() {
  showWelcome()
  
  let running = true
  while (running) {
    const action = await mainMenu()
    
    if (action === 'exit') {
      console.log(colors.success(`\n${icons.success} Thank you for using Brainy!\n`))
      running = false
    } else {
      await executeCommand(action)
      
      // Pause before returning to menu
      await inquirer.prompt([{
        type: 'input',
        name: 'continue',
        message: colors.dim('\nPress Enter to continue...'),
        prefix: ''
      }])
    }
  }
  
  process.exit(0)
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error(colors.error(`\n${icons.error} Unexpected error:`))
  console.error(colors.red(error.message))
  process.exit(1)
})

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(colors.info(`\n\n${icons.info} Exiting Brainy...`))
  process.exit(0)
})

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(colors.error('Fatal error:'), error)
    process.exit(1)
  })
}

export { main as startInteractiveMode }