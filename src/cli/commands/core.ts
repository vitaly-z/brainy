/**
 * Core CLI Commands - TypeScript Implementation
 * 
 * Essential database operations: add, search, get, relate, import, export
 */

import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { readFileSync, writeFileSync } from 'node:fs'
import { Brainy } from '../../brainy.js'
import { BrainyTypes, NounType, VerbType } from '../../index.js'

interface CoreOptions {
  verbose?: boolean
  json?: boolean
  pretty?: boolean
}

interface AddOptions extends CoreOptions {
  id?: string
  metadata?: string
  type?: string
  confidence?: string
  weight?: string
}

interface SearchOptions extends CoreOptions {
  limit?: string
  offset?: string
  threshold?: string
  type?: string
  where?: string
  near?: string
  connectedTo?: string
  connectedFrom?: string
  via?: string
  explain?: boolean
  includeRelations?: boolean
  includeVfs?: boolean
  fusion?: string
  vectorWeight?: string
  graphWeight?: string
  fieldWeight?: string
}

interface GetOptions extends CoreOptions {
  withConnections?: boolean
}

interface RelateOptions extends CoreOptions {
  weight?: string
  metadata?: string
}

interface ExportOptions extends CoreOptions {
  format?: 'json' | 'csv' | 'jsonl'
}

let brainyInstance: Brainy | null = null

const getBrainy = (): Brainy => {
  if (!brainyInstance) {
    brainyInstance = new Brainy()
  }
  return brainyInstance
}

const formatOutput = (data: any, options: CoreOptions): void => {
  if (options.json) {
    console.log(options.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data))
  }
}

export const coreCommands = {
  /**
   * Add data to the neural database
   */
  async add(text: string | undefined, options: AddOptions) {
    let spinner: any = null
    try {
      // Interactive mode if no text provided
      if (!text) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'content',
            message: 'Enter content:',
            validate: (input: string) => input.trim().length > 0 || 'Content cannot be empty'
          },
          {
            type: 'input',
            name: 'nounType',
            message: 'Noun type (optional, press Enter to auto-detect):',
            default: ''
          },
          {
            type: 'input',
            name: 'metadata',
            message: 'Metadata (JSON, optional):',
            default: '',
            validate: (input: string) => {
              if (!input.trim()) return true
              try {
                JSON.parse(input)
                return true
              } catch {
                return 'Invalid JSON format'
              }
            }
          }
        ])

        text = answers.content
        if (answers.nounType) {
          options.type = answers.nounType
        }
        if (answers.metadata) {
          options.metadata = answers.metadata
        }
      }

      const spinner = ora('Adding to neural database...').start()
      const brain = getBrainy()

      let metadata: any = {}
      if (options.metadata) {
        try {
          metadata = JSON.parse(options.metadata)
        } catch {
          spinner.fail('Invalid metadata JSON')
          process.exit(1)
        }
      }

      if (options.id) {
        metadata.id = options.id
      }
      
      // Determine noun type
      let nounType: NounType
      if (options.type) {
        // Validate provided type
        if (!BrainyTypes.isValidNoun(options.type)) {
          spinner.fail(`Invalid noun type: ${options.type}`)
          console.log(chalk.dim('Run "brainy types --noun" to see valid types'))
          process.exit(1)
        }
        nounType = options.type as NounType
      } else {
        // Default to Thing when no type specified
        nounType = NounType.Thing
        spinner.text = `No type specified, using default: ${nounType}`
      }
      
      // Add with explicit type
      const addParams: any = {
        data: text,
        type: nounType,
        metadata
      }

      // Add confidence and weight if provided
      if (options.confidence) {
        addParams.confidence = parseFloat(options.confidence)
      }
      if (options.weight) {
        addParams.weight = parseFloat(options.weight)
      }

      const result = await brain.add(addParams)

      spinner.succeed('Added successfully')

      if (!options.json) {
        console.log(chalk.green(`✓ Added with ID: ${result}`))
        if (options.type) {
          console.log(chalk.dim(`  Type: ${options.type}`))
        }
        if (options.confidence) {
          console.log(chalk.dim(`  Confidence: ${options.confidence}`))
        }
        if (options.weight) {
          console.log(chalk.dim(`  Weight: ${options.weight}`))
        }
        if (Object.keys(metadata).length > 0) {
          console.log(chalk.dim(`  Metadata: ${JSON.stringify(metadata)}`))
        }
      } else {
        formatOutput({ id: result, metadata, confidence: addParams.confidence, weight: addParams.weight }, options)
      }
    } catch (error: any) {
      if (spinner) spinner.fail('Failed to add data')
      console.error(chalk.red('Failed to add data:', error.message))
      process.exit(1)
    }
  },

  /**
   * Search the neural database with Triple Intelligence™
   */
  async search(query: string | undefined, options: SearchOptions) {
    let spinner: any = null
    try {
      // Interactive mode if no query provided
      if (!query) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'query',
            message: 'What are you looking for?',
            validate: (input: string) => input.trim().length > 0 || 'Query cannot be empty'
          },
          {
            type: 'number',
            name: 'limit',
            message: 'Number of results:',
            default: 10
          },
          {
            type: 'confirm',
            name: 'useAdvanced',
            message: 'Use advanced filters?',
            default: false
          }
        ])

        query = answers.query
        if (!options.limit) {
          options.limit = answers.limit.toString()
        }

        // Advanced filters
        if (answers.useAdvanced) {
          const advancedAnswers = await inquirer.prompt([
            {
              type: 'input',
              name: 'type',
              message: 'Filter by type (optional):',
              default: ''
            },
            {
              type: 'input',
              name: 'threshold',
              message: 'Similarity threshold (0-1, default 0.7):',
              default: '0.7',
              validate: (input: string) => {
                const num = parseFloat(input)
                return (num >= 0 && num <= 1) || 'Must be between 0 and 1'
              }
            },
            {
              type: 'confirm',
              name: 'explain',
              message: 'Show scoring breakdown?',
              default: false
            }
          ])

          if (advancedAnswers.type) options.type = advancedAnswers.type
          if (advancedAnswers.threshold) options.threshold = advancedAnswers.threshold
          options.explain = advancedAnswers.explain
        }
      }

      const spinner = ora('Searching with Triple Intelligence™...').start()
      const brain = getBrainy()

      // Build comprehensive search params
      const searchParams: any = {
        query,
        limit: options.limit ? parseInt(options.limit) : 10
      }

      // Pagination
      if (options.offset) {
        searchParams.offset = parseInt(options.offset)
      }

      // Vector Intelligence - similarity threshold
      if (options.threshold) {
        searchParams.near = { threshold: parseFloat(options.threshold) }
      }

      // Metadata Intelligence - type filtering
      if (options.type) {
        const types = options.type.split(',').map(t => t.trim())
        searchParams.type = types.length === 1 ? types[0] : types
      }

      // Metadata Intelligence - field filtering
      if (options.where) {
        try {
          searchParams.where = JSON.parse(options.where)
        } catch {
          spinner.fail('Invalid --where JSON')
          console.log(chalk.dim('Example: --where \'{"status":"active","priority":{"$gte":5}}\''))
          process.exit(1)
        }
      }

      // Vector Intelligence - proximity search
      if (options.near) {
        searchParams.near = {
          id: options.near,
          threshold: options.threshold ? parseFloat(options.threshold) : 0.7
        }
      }

      // Graph Intelligence - connection constraints
      if (options.connectedTo || options.connectedFrom || options.via) {
        searchParams.connected = {}

        if (options.connectedTo) {
          searchParams.connected.to = options.connectedTo
        }

        if (options.connectedFrom) {
          searchParams.connected.from = options.connectedFrom
        }

        if (options.via) {
          const vias = options.via.split(',').map(v => v.trim())
          searchParams.connected.via = vias.length === 1 ? vias[0] : vias
        }
      }

      // Explanation
      if (options.explain) {
        searchParams.explain = true
      }

      // Include relationships
      if (options.includeRelations) {
        searchParams.includeRelations = true
      }

      // VFS is now part of the knowledge graph (included by default)
      // Users can exclude VFS with --where vfsType exists:false if needed

      // Triple Intelligence Fusion - custom weighting
      if (options.fusion || options.vectorWeight || options.graphWeight || options.fieldWeight) {
        searchParams.fusion = {
          strategy: options.fusion || 'adaptive',
          weights: {}
        }

        if (options.vectorWeight) {
          searchParams.fusion.weights.vector = parseFloat(options.vectorWeight)
        }
        if (options.graphWeight) {
          searchParams.fusion.weights.graph = parseFloat(options.graphWeight)
        }
        if (options.fieldWeight) {
          searchParams.fusion.weights.field = parseFloat(options.fieldWeight)
        }
      }

      const results = await brain.find(searchParams)

      spinner.succeed(`Found ${results.length} results`)

      if (!options.json) {
        if (results.length === 0) {
          console.log(chalk.yellow('\nNo results found'))

          // Show helpful hints
          console.log(chalk.dim('\nTips:'))
          console.log(chalk.dim('  • Try different search terms'))
          console.log(chalk.dim('  • Remove filters (--type, --where, --connected-to)'))
          console.log(chalk.dim('  • Lower the --threshold value'))
        } else {
          console.log(chalk.cyan(`\n📊 Triple Intelligence Results:\n`))

          results.forEach((result, i) => {
            const entity = result.entity || result
            console.log(chalk.bold(`${i + 1}. ${entity.id}`))

            // Show score with breakdown
            if (result.score !== undefined) {
              console.log(chalk.green(`   Score: ${(result.score * 100).toFixed(1)}%`))

              if (options.explain && (result as any).scores) {
                const scores = (result as any).scores
                if (scores.vector !== undefined) {
                  console.log(chalk.dim(`     Vector: ${(scores.vector * 100).toFixed(1)}%`))
                }
                if (scores.graph !== undefined) {
                  console.log(chalk.dim(`     Graph: ${(scores.graph * 100).toFixed(1)}%`))
                }
                if (scores.field !== undefined) {
                  console.log(chalk.dim(`     Field: ${(scores.field * 100).toFixed(1)}%`))
                }
              }
            }

            // Show type
            if ((entity as any).type) {
              console.log(chalk.dim(`   Type: ${(entity as any).type}`))
            }

            // Show content preview
            if ((entity as any).content) {
              const preview = (entity as any).content.substring(0, 80)
              console.log(chalk.dim(`   Content: ${preview}${(entity as any).content.length > 80 ? '...' : ''}`))
            }

            // Show metadata
            if ((entity as any).metadata && Object.keys((entity as any).metadata).length > 0) {
              console.log(chalk.dim(`   Metadata: ${JSON.stringify((entity as any).metadata)}`))
            }

            // Show relationships
            if (options.includeRelations && (result as any).relations) {
              const relations = (result as any).relations
              if (relations.length > 0) {
                console.log(chalk.dim(`   Relations: ${relations.length} connections`))
              }
            }

            console.log()
          })

          // Show search summary
          console.log(chalk.cyan('Search Configuration:'))
          if (searchParams.type) {
            console.log(chalk.dim(`  Type filter: ${Array.isArray(searchParams.type) ? searchParams.type.join(', ') : searchParams.type}`))
          }
          if (searchParams.where) {
            console.log(chalk.dim(`  Field filter: ${JSON.stringify(searchParams.where)}`))
          }
          if (searchParams.connected) {
            console.log(chalk.dim(`  Graph filter: ${JSON.stringify(searchParams.connected)}`))
          }
          if (searchParams.fusion) {
            console.log(chalk.dim(`  Fusion: ${searchParams.fusion.strategy}`))
            if (searchParams.fusion.weights && Object.keys(searchParams.fusion.weights).length > 0) {
              console.log(chalk.dim(`  Weights: ${JSON.stringify(searchParams.fusion.weights)}`))
            }
          }
        }
      } else {
        formatOutput(results, options)
      }
    } catch (error: any) {
      if (spinner) spinner.fail('Search failed')
      console.error(chalk.red('Search failed:', error.message))
      if (options.verbose) {
        console.error(chalk.dim(error.stack))
      }
      process.exit(1)
    }
  },

  /**
   * Get item by ID
   */
  async get(id: string | undefined, options: GetOptions) {
    let spinner: any = null
    try {
      // Interactive mode if no ID provided
      if (!id) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'id',
            message: 'Enter item ID:',
            validate: (input: string) => input.trim().length > 0 || 'ID cannot be empty'
          },
          {
            type: 'confirm',
            name: 'withConnections',
            message: 'Include connections?',
            default: false
          }
        ])

        id = answers.id
        options.withConnections = answers.withConnections
      }

      const spinner = ora('Fetching item...').start()
      const brain = getBrainy()

      // Try to get the item
      const item = await brain.get(id)

      if (!item) {
        spinner.fail('Item not found')
        console.log(chalk.yellow(`No item found with ID: ${id}`))
        process.exit(1)
      }
      spinner.succeed('Item found')
      
      if (!options.json) {
        console.log(chalk.cyan('\nItem Details:'))
        console.log(`  ID: ${item.id}`)
        console.log(`  Content: ${(item as any).content || 'N/A'}`)
        if (item.metadata) {
          console.log(`  Metadata: ${JSON.stringify(item.metadata, null, 2)}`)
        }
        
        if (options.withConnections) {
          // Get verbs/relationships
          // Get connections if method exists
          const connections = (brain as any).getConnections ? await (brain as any).getConnections(id) : []
          if (connections && connections.length > 0) {
            console.log(chalk.cyan('\nConnections:'))
            connections.forEach((conn: any) => {
              console.log(`  ${conn.source} --[${conn.type}]--> ${conn.target}`)
            })
          }
        }
      } else {
        formatOutput(item, options)
      }
    } catch (error: any) {
      if (spinner) spinner.fail('Failed to get item')
      console.error(chalk.red('Failed to get item:', error.message))
      process.exit(1)
    }
  },

  /**
   * Create relationship between items
   */
  async relate(source: string | undefined, verb: string | undefined, target: string | undefined, options: RelateOptions) {
    let spinner: any = null
    try {
      // Interactive mode if parameters missing
      if (!source || !verb || !target) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'source',
            message: 'Source entity ID:',
            default: source || '',
            validate: (input: string) => input.trim().length > 0 || 'Source ID cannot be empty'
          },
          {
            type: 'input',
            name: 'verb',
            message: 'Relationship type (verb):',
            default: verb || '',
            validate: (input: string) => input.trim().length > 0 || 'Verb cannot be empty'
          },
          {
            type: 'input',
            name: 'target',
            message: 'Target entity ID:',
            default: target || '',
            validate: (input: string) => input.trim().length > 0 || 'Target ID cannot be empty'
          },
          {
            type: 'input',
            name: 'weight',
            message: 'Relationship weight (0-1, optional):',
            default: '',
            validate: (input: string) => {
              if (!input.trim()) return true
              const num = parseFloat(input)
              return (num >= 0 && num <= 1) || 'Must be between 0 and 1'
            }
          }
        ])

        source = answers.source
        verb = answers.verb
        target = answers.target
        if (answers.weight) {
          options.weight = answers.weight
        }
      }

      const spinner = ora('Creating relationship...').start()
      const brain = getBrainy()

      let metadata: any = {}
      if (options.metadata) {
        try {
          metadata = JSON.parse(options.metadata)
        } catch {
          spinner.fail('Invalid metadata JSON')
          process.exit(1)
        }
      }
      
      if (options.weight) {
        metadata.weight = parseFloat(options.weight)
      }
      
      // Create the relationship
      const result = await brain.relate({
        from: source,
        to: target,
        type: verb as any,
        metadata
      })
      
      spinner.succeed('Relationship created')
      
      if (!options.json) {
        console.log(chalk.green(`✓ Created relationship with ID: ${result}`))
        console.log(chalk.dim(`  ${source} --[${verb}]--> ${target}`))
        if (metadata.weight) {
          console.log(chalk.dim(`  Weight: ${metadata.weight}`))
        }
      } else {
        formatOutput({ id: result, source, verb, target, metadata }, options)
      }
    } catch (error: any) {
      if (spinner) spinner.fail('Failed to create relationship')
      console.error(chalk.red('Failed to create relationship:', error.message))
      process.exit(1)
    }
  },

  /**
   * Update an existing entity
   */
  async update(id: string | undefined, options: AddOptions & { content?: string }) {
    let spinner: any = null
    try {
      // Interactive mode if no ID provided
      if (!id) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'id',
            message: 'Entity ID to update:',
            validate: (input: string) => input.trim().length > 0 || 'ID cannot be empty'
          },
          {
            type: 'input',
            name: 'content',
            message: 'New content (optional, press Enter to skip):',
            default: ''
          },
          {
            type: 'input',
            name: 'metadata',
            message: 'Metadata to merge (JSON, optional):',
            default: '',
            validate: (input: string) => {
              if (!input.trim()) return true
              try {
                JSON.parse(input)
                return true
              } catch {
                return 'Invalid JSON format'
              }
            }
          }
        ])

        id = answers.id
        if (answers.content) {
          options.content = answers.content
        }
        if (answers.metadata) {
          options.metadata = answers.metadata
        }
      }

      spinner = ora('Updating entity...').start()
      const brain = getBrainy()

      // Get existing entity first
      const existing = await brain.get(id)
      if (!existing) {
        spinner.fail('Entity not found')
        console.log(chalk.yellow(`No entity found with ID: ${id}`))
        process.exit(1)
      }

      // Build update params
      const updateParams: any = { id }

      if (options.content) {
        updateParams.data = options.content
      }

      if (options.metadata) {
        try {
          const newMetadata = JSON.parse(options.metadata)
          updateParams.metadata = {
            ...existing.metadata,
            ...newMetadata
          }
        } catch {
          spinner.fail('Invalid metadata JSON')
          process.exit(1)
        }
      }

      if (options.type) {
        updateParams.type = options.type
      }

      await brain.update(updateParams)

      spinner.succeed('Entity updated successfully')

      if (!options.json) {
        console.log(chalk.green(`✓ Updated entity: ${id}`))
        if (options.content) {
          console.log(chalk.dim(`  New content: ${options.content.substring(0, 80)}...`))
        }
        if (updateParams.metadata) {
          console.log(chalk.dim(`  Metadata: ${JSON.stringify(updateParams.metadata)}`))
        }
      } else {
        formatOutput({ id, updated: true }, options)
      }
    } catch (error: any) {
      if (spinner) spinner.fail('Failed to update entity')
      console.error(chalk.red('Update failed:', error.message))
      process.exit(1)
    }
  },

  /**
   * Delete an entity
   */
  async deleteEntity(id: string | undefined, options: CoreOptions & { force?: boolean }) {
    let spinner: any = null
    try {
      // Interactive mode if no ID provided
      if (!id) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'id',
            message: 'Entity ID to delete:',
            validate: (input: string) => input.trim().length > 0 || 'ID cannot be empty'
          },
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure? This cannot be undone.',
            default: false
          }
        ])

        if (!answers.confirm) {
          console.log(chalk.yellow('Delete cancelled'))
          return
        }

        id = answers.id
      } else if (!options.force) {
        // Confirmation for non-interactive mode
        const answer = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `Delete entity ${id}? This cannot be undone.`,
          default: false
        }])

        if (!answer.confirm) {
          console.log(chalk.yellow('Delete cancelled'))
          return
        }
      }

      spinner = ora('Deleting entity...').start()
      const brain = getBrainy()

      await brain.delete(id)

      spinner.succeed('Entity deleted successfully')

      if (!options.json) {
        console.log(chalk.green(`✓ Deleted entity: ${id}`))
      } else {
        formatOutput({ id, deleted: true }, options)
      }
    } catch (error: any) {
      if (spinner) spinner.fail('Failed to delete entity')
      console.error(chalk.red('Delete failed:', error.message))
      process.exit(1)
    }
  },

  /**
   * Remove a relationship
   */
  async unrelate(id: string | undefined, options: CoreOptions & { force?: boolean }) {
    let spinner: any = null
    try {
      // Interactive mode if no ID provided
      if (!id) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'id',
            message: 'Relationship ID to remove:',
            validate: (input: string) => input.trim().length > 0 || 'ID cannot be empty'
          },
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Remove this relationship?',
            default: false
          }
        ])

        if (!answers.confirm) {
          console.log(chalk.yellow('Operation cancelled'))
          return
        }

        id = answers.id
      } else if (!options.force) {
        const answer = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `Remove relationship ${id}?`,
          default: false
        }])

        if (!answer.confirm) {
          console.log(chalk.yellow('Operation cancelled'))
          return
        }
      }

      spinner = ora('Removing relationship...').start()
      const brain = getBrainy()

      await brain.unrelate(id)

      spinner.succeed('Relationship removed successfully')

      if (!options.json) {
        console.log(chalk.green(`✓ Removed relationship: ${id}`))
      } else {
        formatOutput({ id, removed: true }, options)
      }
    } catch (error: any) {
      if (spinner) spinner.fail('Failed to remove relationship')
      console.error(chalk.red('Unrelate failed:', error.message))
      process.exit(1)
    }
  },

  /**
   * Export database
   */
  async export(file: string | undefined, options: ExportOptions) {
    const spinner = ora('Exporting database...').start()
    
    try {
      const brain = getBrainy()
      const format = options.format || 'json'
      
      // Export all data
      const dataApi = await brain.data()
      const data = await dataApi.export({ format: 'json' })
      let output = ''
      
      switch (format) {
        case 'json':
          output = options.pretty 
            ? JSON.stringify(data, null, 2)
            : JSON.stringify(data)
          break
          
        case 'jsonl':
          if (Array.isArray(data)) {
            output = data.map(item => JSON.stringify(item)).join('\n')
          } else {
            output = JSON.stringify(data)
          }
          break
          
        case 'csv':
          if (Array.isArray(data) && data.length > 0) {
            // Get all unique keys for headers
            const headers = new Set<string>()
            data.forEach(item => {
              Object.keys(item).forEach(key => headers.add(key))
            })
            const headerArray = Array.from(headers)
            
            // Create CSV
            output = headerArray.join(',') + '\n'
            output += data.map(item => {
              return headerArray.map(h => {
                const value = item[h]
                if (typeof value === 'object') {
                  return JSON.stringify(value)
                }
                return value || ''
              }).join(',')
            }).join('\n')
          }
          break
      }
      
      if (file) {
        writeFileSync(file, output)
        spinner.succeed(`Exported to ${file}`)
        
        if (!options.json) {
          console.log(chalk.green(`✓ Successfully exported database to ${file}`))
          console.log(chalk.dim(`  Format: ${format}`))
          console.log(chalk.dim(`  Items: ${Array.isArray(data) ? data.length : 1}`))
        } else {
          formatOutput({ file, format, count: Array.isArray(data) ? data.length : 1 }, options)
        }
      } else {
        spinner.succeed('Export complete')
        console.log(output)
      }
    } catch (error: any) {
      spinner.fail('Export failed')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * Show plugin and provider diagnostics
   */
  async diagnostics(options: CoreOptions) {
    try {
      const brain = getBrainy()
      await brain.init()

      const diag = brain.diagnostics()

      if (options.json) {
        formatOutput(diag, options)
        return
      }

      console.log(chalk.bold('\nBrainy Diagnostics'))
      console.log(chalk.dim(`Version: ${diag.version}`))
      console.log()

      // Plugins
      console.log(chalk.bold('Plugins:'))
      if (diag.plugins.count === 0) {
        console.log(chalk.dim('  (none active)'))
      } else {
        for (const name of diag.plugins.active) {
          console.log(chalk.green(`  ✓ ${name}`))
        }
      }
      console.log()

      // Providers
      console.log(chalk.bold('Providers:'))
      for (const [key, info] of Object.entries(diag.providers)) {
        const icon = info.source === 'plugin' ? chalk.green('✓ plugin') : chalk.dim('default')
        console.log(`  ${key.padEnd(16)} ${icon}`)
      }
      console.log()

      // Indexes
      console.log(chalk.bold('Indexes:'))
      console.log(`  HNSW:      ${diag.indexes.hnsw.type} (${diag.indexes.hnsw.size} vectors)`)
      console.log(`  Metadata:  ${diag.indexes.metadata.type} (initialized: ${diag.indexes.metadata.initialized})`)
      console.log(`  Graph:     ${diag.indexes.graph.type} (initialized: ${diag.indexes.graph.initialized}, wired: ${diag.indexes.graph.wiredToStorage})`)
      console.log()
    } catch (error: any) {
      console.error(chalk.red('Diagnostics failed: ' + error.message))
      process.exit(1)
    }
  }
}