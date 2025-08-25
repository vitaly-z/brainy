/**
 * Professional Interactive CLI System
 * 
 * Provides consistent, delightful interactive prompts for all commands
 * with smart defaults, validation, and helpful examples
 */

import chalk from 'chalk'
import inquirer from 'inquirer'
import fuzzy from 'fuzzy'
import ora from 'ora'
import { BrainyData } from '../brainyData.js'

// Professional color scheme
export const colors = {
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
export const icons = {
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
  chat: '💬'
}

// Store recent inputs for smart suggestions
const recentInputs = {
  searches: [] as string[],
  ids: [] as string[],
  types: [] as string[],
  formats: [] as string[]
}

/**
 * Professional prompt wrapper with consistent styling
 */
export async function prompt(config: any): Promise<any> {
  // Add consistent styling
  if (config.message) {
    config.message = colors.cyan(config.message)
  }
  
  // Add prefix with appropriate icon
  if (!config.prefix) {
    config.prefix = colors.dim('  › ')
  }
  
  return inquirer.prompt([config])
}

/**
 * Interactive prompt for search query with smart features
 */
export async function promptSearchQuery(previousSearches?: string[]): Promise<string> {
  console.log(colors.primary(`\n${icons.search} Smart Search\n`))
  console.log(colors.dim('Search your neural database with natural language'))
  console.log(colors.dim('Examples: "meetings last week", "John from Google", "important documents"'))
  
  const { query } = await prompt({
    type: 'input',
    name: 'query',
    message: 'What would you like to search for?',
    validate: (input: string) => {
      if (!input.trim()) {
        return 'Please enter a search query'
      }
      return true
    },
    transformer: (input: string) => {
      // Show live character count
      const count = input.length
      if (count > 100) {
        return colors.warning(input)
      }
      return colors.green(input)
    }
  })
  
  // Store for future suggestions
  if (!recentInputs.searches.includes(query)) {
    recentInputs.searches.unshift(query)
    recentInputs.searches = recentInputs.searches.slice(0, 10)
  }
  
  return query
}

/**
 * Interactive prompt for item ID with fuzzy search
 */
export async function promptItemId(
  action: string,
  brain?: BrainyData,
  allowMultiple: boolean = false
): Promise<string | string[]> {
  console.log(colors.primary(`\n${icons.thinking} Select item to ${action}\n`))
  
  // If we have brain instance, show recent items
  let choices: any[] = []
  if (brain) {
    try {
      const recent = await brain.search('*', 10, { 
        sortBy: 'timestamp',
        descending: true 
      })
      
      choices = recent.map(item => ({
        name: `${item.id} - ${item.content?.substring(0, 50)}...`,
        value: item.id,
        short: item.id
      }))
    } catch {
      // Fallback to manual input
    }
  }
  
  if (choices.length > 0) {
    choices.push(new inquirer.Separator())
    choices.push({ name: 'Enter ID manually', value: '__manual__' })
    
    const { selected } = await prompt({
      type: allowMultiple ? 'checkbox' : 'list',
      name: 'selected',
      message: `Select item(s) to ${action}:`,
      choices,
      pageSize: 10
    })
    
    if (selected === '__manual__' || (Array.isArray(selected) && selected.includes('__manual__'))) {
      return promptManualId(action, allowMultiple)
    }
    
    return selected
  } else {
    return promptManualId(action, allowMultiple)
  }
}

/**
 * Manual ID input with validation
 */
async function promptManualId(action: string, allowMultiple: boolean): Promise<string | string[]> {
  const { id } = await prompt({
    type: 'input',
    name: 'id',
    message: allowMultiple 
      ? `Enter ID(s) to ${action} (comma-separated):`
      : `Enter ID to ${action}:`,
    validate: (input: string) => {
      if (!input.trim()) {
        return `Please enter at least one ID`
      }
      return true
    }
  })
  
  if (allowMultiple) {
    return id.split(',').map((i: string) => i.trim()).filter(Boolean)
  }
  return id.trim()
}

/**
 * Confirm destructive action with preview
 */
export async function confirmDestructiveAction(
  action: string,
  items: any[],
  showPreview: boolean = true
): Promise<boolean> {
  console.log(colors.warning(`\n${icons.warning} Confirmation Required\n`))
  
  if (showPreview && items.length > 0) {
    console.log(colors.dim(`You are about to ${action}:`))
    items.slice(0, 5).forEach(item => {
      console.log(colors.dim(`  • ${item.id || item}`))
    })
    if (items.length > 5) {
      console.log(colors.dim(`  ... and ${items.length - 5} more`))
    }
    console.log()
  }
  
  const { confirm } = await prompt({
    type: 'confirm',
    name: 'confirm',
    message: colors.warning(`Are you sure you want to ${action}?`),
    default: false
  })
  
  return confirm
}

/**
 * Interactive data input with multiline support
 */
export async function promptDataInput(
  action: string = 'add',
  currentValue?: string
): Promise<string> {
  console.log(colors.primary(`\n${icons.add} ${action === 'add' ? 'Add Data' : 'Update Data'}\n`))
  
  if (currentValue) {
    console.log(colors.dim('Current value:'))
    console.log(colors.info(`  ${currentValue.substring(0, 100)}${currentValue.length > 100 ? '...' : ''}`))
    console.log()
  }
  
  const { data } = await prompt({
    type: 'editor',
    name: 'data',
    message: 'Enter your data:',
    default: currentValue || '',
    postfix: '.md',
    validate: (input: string) => {
      if (!input.trim() && action === 'add') {
        return 'Please enter some data'
      }
      return true
    }
  })
  
  return data
}

/**
 * Interactive metadata input with JSON validation
 */
export async function promptMetadata(
  currentMetadata?: any,
  suggestions?: string[]
): Promise<any> {
  console.log(colors.dim('\nOptional: Add metadata (JSON format)'))
  
  const { addMetadata } = await prompt({
    type: 'confirm',
    name: 'addMetadata',
    message: 'Would you like to add metadata?',
    default: false
  })
  
  if (!addMetadata) {
    return {}
  }
  
  // Show field suggestions if available
  if (suggestions && suggestions.length > 0) {
    console.log(colors.dim('\nAvailable fields:'))
    suggestions.forEach(field => {
      console.log(colors.dim(`  • ${field}`))
    })
  }
  
  const { metadata } = await prompt({
    type: 'editor',
    name: 'metadata',
    message: 'Enter metadata (JSON):',
    default: currentMetadata ? JSON.stringify(currentMetadata, null, 2) : '{\n  \n}',
    postfix: '.json',
    validate: (input: string) => {
      try {
        JSON.parse(input)
        return true
      } catch (e) {
        return `Invalid JSON: ${e.message}`
      }
    }
  })
  
  return JSON.parse(metadata)
}

/**
 * Interactive format selector
 */
export async function promptFormat(
  availableFormats: string[],
  defaultFormat: string
): Promise<string> {
  console.log(colors.primary(`\n${icons.export} Select Format\n`))
  
  const { format } = await prompt({
    type: 'list',
    name: 'format',
    message: 'Choose export format:',
    choices: availableFormats.map(f => ({
      name: getFormatDescription(f),
      value: f,
      short: f
    })),
    default: defaultFormat
  })
  
  return format
}

/**
 * Get friendly format descriptions
 */
function getFormatDescription(format: string): string {
  const descriptions: Record<string, string> = {
    json: 'JSON - Universal data interchange',
    jsonl: 'JSON Lines - Streaming format',
    csv: 'CSV - Spreadsheet compatible',
    graphml: 'GraphML - Graph visualization',
    dot: 'DOT - Graphviz format',
    d3: 'D3.js - Web visualization',
    markdown: 'Markdown - Human readable',
    yaml: 'YAML - Configuration format'
  }
  
  return `${format.toUpperCase()} - ${descriptions[format] || 'Custom format'}`
}

/**
 * Interactive file/URL input with validation
 */
export async function promptFileOrUrl(
  action: string = 'import'
): Promise<string> {
  console.log(colors.primary(`\n${icons.import} ${action === 'import' ? 'Import Source' : 'Export Destination'}\n`))
  
  const { sourceType } = await prompt({
    type: 'list',
    name: 'sourceType',
    message: 'What type of source?',
    choices: [
      { name: 'Local file', value: 'file' },
      { name: 'URL', value: 'url' },
      { name: 'Clipboard', value: 'clipboard' },
      { name: 'Direct input', value: 'input' }
    ]
  })
  
  switch (sourceType) {
    case 'file':
      return promptFilePath(action)
    case 'url':
      return promptUrl()
    case 'clipboard':
      // Would need clipboard integration
      console.log(colors.warning('Clipboard support coming soon!'))
      return promptFilePath(action)
    case 'input':
      const data = await promptDataInput('import')
      // Save to temp file and return path
      const tmpFile = `/tmp/brainy-import-${Date.now()}.json`
      const { writeFileSync } = await import('fs')
      writeFileSync(tmpFile, data)
      return tmpFile
    default:
      return ''
  }
}

/**
 * File path input with autocomplete
 */
async function promptFilePath(action: string): Promise<string> {
  const { path } = await prompt({
    type: 'input',
    name: 'path',
    message: `Enter file path to ${action}:`,
    validate: async (input: string) => {
      if (!input.trim()) {
        return 'Please enter a file path'
      }
      
      const { existsSync } = await import('fs')
      if (action === 'import' && !existsSync(input)) {
        return `File not found: ${input}`
      }
      
      return true
    },
    // Add file path autocomplete
    transformer: (input: string) => {
      if (input.startsWith('~/')) {
        const home = process.env.HOME || '~'
        return colors.green(input.replace('~', home))
      }
      return colors.green(input)
    }
  })
  
  return path
}

/**
 * URL input with validation
 */
async function promptUrl(): Promise<string> {
  const { url } = await prompt({
    type: 'input',
    name: 'url',
    message: 'Enter URL:',
    validate: (input: string) => {
      try {
        new URL(input)
        return true
      } catch {
        return 'Please enter a valid URL'
      }
    }
  })
  
  return url
}

/**
 * Interactive relationship builder
 */
export async function promptRelationship(brain?: BrainyData): Promise<{
  source: string
  verb: string
  target: string
  metadata?: any
}> {
  console.log(colors.primary(`\n${icons.connect} Create Relationship\n`))
  console.log(colors.dim('Connect two items with a semantic relationship'))
  
  // Get source
  const source = await promptItemId('connect from', brain, false) as string
  
  // Get verb/relationship type
  const { verb } = await prompt({
    type: 'list',
    name: 'verb',
    message: 'Relationship type:',
    choices: [
      { name: 'Works For', value: 'WorksFor' },
      { name: 'Knows', value: 'Knows' },
      { name: 'Created By', value: 'CreatedBy' },
      { name: 'Belongs To', value: 'BelongsTo' },
      { name: 'Uses', value: 'Uses' },
      { name: 'Manages', value: 'Manages' },
      { name: 'Located In', value: 'LocatedIn' },
      { name: 'Related To', value: 'RelatedTo' },
      new inquirer.Separator(),
      { name: 'Custom relationship...', value: '__custom__' }
    ]
  })
  
  let finalVerb = verb
  if (verb === '__custom__') {
    const { customVerb } = await prompt({
      type: 'input',
      name: 'customVerb',
      message: 'Enter custom relationship:',
      validate: (input: string) => input.trim() ? true : 'Please enter a relationship'
    })
    finalVerb = customVerb
  }
  
  // Get target
  const target = await promptItemId('connect to', brain, false) as string
  
  // Optional metadata
  const metadata = await promptMetadata()
  
  return {
    source,
    verb: finalVerb,
    target,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined
  }
}

/**
 * Smart command suggestions when user types wrong command
 */
export function suggestCommand(input: string, availableCommands: string[]): string[] {
  const results = fuzzy.filter(input, availableCommands)
  return results.slice(0, 3).map(r => r.string)
}

/**
 * Beautiful error display with helpful context
 */
export function showError(error: Error, context?: string): void {
  console.log()
  console.log(colors.error(`${icons.error} Error`))
  
  if (context) {
    console.log(colors.dim(context))
  }
  
  console.log(colors.red(error.message))
  
  // Provide helpful suggestions based on error
  if (error.message.includes('not found')) {
    console.log(colors.dim('\nTip: Use "brainy search" to find items'))
  } else if (error.message.includes('network') || error.message.includes('fetch')) {
    console.log(colors.dim('\nTip: Check your internet connection'))
  } else if (error.message.includes('permission')) {
    console.log(colors.dim('\nTip: Check file permissions or run with appropriate access'))
  }
}

/**
 * Progress indicator for long operations
 */
export class ProgressTracker {
  private spinner: any
  private startTime: number
  
  constructor(message: string) {
    this.spinner = ora({
      text: message,
      color: 'cyan',
      spinner: 'dots'
    }).start()
    this.startTime = Date.now()
  }
  
  update(message: string, count?: number, total?: number): void {
    if (count && total) {
      const percent = Math.round((count / total) * 100)
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1)
      this.spinner.text = `${message} (${percent}% - ${elapsed}s)`
    } else {
      this.spinner.text = message
    }
  }
  
  succeed(message?: string): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1)
    this.spinner.succeed(message ? `${message} (${elapsed}s)` : `Done (${elapsed}s)`)
  }
  
  fail(message?: string): void {
    this.spinner.fail(message || 'Failed')
  }
  
  stop(): void {
    this.spinner.stop()
  }
}

/**
 * Welcome message for interactive mode
 */
export function showWelcome(): void {
  console.clear()
  console.log(colors.primary(`
╔══════════════════════════════════════════════╗
║                                              ║
║     ${icons.brain}  BRAINY - Neural Intelligence     ║
║         Your AI-Powered Second Brain         ║
║                                              ║
╚══════════════════════════════════════════════╝
`))
  console.log(colors.dim('Version 1.5.0 • Type "help" for commands'))
  console.log()
}

/**
 * Interactive command selector for beginners
 */
export async function promptCommand(): Promise<string> {
  const { command } = await prompt({
    type: 'list',
    name: 'command',
    message: 'What would you like to do?',
    choices: [
      { name: `${icons.add} Add data to your brain`, value: 'add' },
      { name: `${icons.search} Search your knowledge`, value: 'search' },
      { name: `${icons.chat} Chat with your data`, value: 'chat' },
      { name: `${icons.update} Update existing data`, value: 'update' },
      { name: `${icons.delete} Delete data`, value: 'delete' },
      { name: `${icons.connect} Create relationships`, value: 'relate' },
      { name: `${icons.import} Import from file`, value: 'import' },
      { name: `${icons.export} Export your brain`, value: 'export' },
      new inquirer.Separator(),
      { name: `${icons.brain} Neural operations`, value: 'neural' },
      { name: `${icons.info} View statistics`, value: 'status' },
      { name: 'Exit', value: 'exit' }
    ],
    pageSize: 15
  })
  
  return command
}

/**
 * Export all interactive components
 */
export default {
  colors,
  icons,
  prompt,
  promptSearchQuery,
  promptItemId,
  confirmDestructiveAction,
  promptDataInput,
  promptMetadata,
  promptFormat,
  promptFileOrUrl,
  promptRelationship,
  suggestCommand,
  showError,
  ProgressTracker,
  showWelcome,
  promptCommand
}