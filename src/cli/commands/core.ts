/**
 * Core CLI Commands - TypeScript Implementation
 * 
 * Essential database operations: add, search, get, relate, import, export
 */

import chalk from 'chalk'
import ora from 'ora'
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

interface ImportOptions extends CoreOptions {
  format?: 'json' | 'csv' | 'jsonl'
  batchSize?: string
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
  async add(text: string, options: AddOptions) {
    const spinner = ora('Adding to neural database...').start()
    
    try {
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
        // Use AI to suggest type
        spinner.text = 'Detecting type with AI...'
        const suggestion = await BrainyTypes.suggestNoun(
          typeof text === 'string' ? { content: text, ...metadata } : text
        )
        
        if (suggestion.confidence < 0.6) {
          spinner.fail('Could not determine type with confidence')
          console.log(chalk.yellow(`Suggestion: ${suggestion.type} (${(suggestion.confidence * 100).toFixed(1)}%)`))
          console.log(chalk.dim('Use --type flag to specify explicitly'))
          process.exit(1)
        }
        
        nounType = suggestion.type as NounType
        spinner.text = `Using detected type: ${nounType}`
      }
      
      // Add with explicit type
      const result = await brain.add({
        data: text,
        type: nounType,
        metadata
      })
      
      spinner.succeed('Added successfully')
      
      if (!options.json) {
        console.log(chalk.green(`✓ Added with ID: ${result}`))
        if (options.type) {
          console.log(chalk.dim(`  Type: ${options.type}`))
        }
        if (Object.keys(metadata).length > 0) {
          console.log(chalk.dim(`  Metadata: ${JSON.stringify(metadata)}`))
        }
      } else {
        formatOutput({ id: result, metadata }, options)
      }
    } catch (error: any) {
      spinner.fail('Failed to add data')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * Search the neural database with Triple Intelligence™
   */
  async search(query: string, options: SearchOptions) {
    const spinner = ora('Searching with Triple Intelligence™...').start()

    try {
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
      spinner.fail('Search failed')
      console.error(chalk.red(error.message))
      if (options.verbose) {
        console.error(chalk.dim(error.stack))
      }
      process.exit(1)
    }
  },

  /**
   * Get item by ID
   */
  async get(id: string, options: GetOptions) {
    const spinner = ora('Fetching item...').start()
    
    try {
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
      spinner.fail('Failed to get item')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * Create relationship between items
   */
  async relate(source: string, verb: string, target: string, options: RelateOptions) {
    const spinner = ora('Creating relationship...').start()
    
    try {
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
      spinner.fail('Failed to create relationship')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * Import data from file
   */
  async import(file: string, options: ImportOptions) {
    const spinner = ora('Importing data...').start()
    
    try {
      const brain = getBrainy()
      const format = options.format || 'json'
      const batchSize = options.batchSize ? parseInt(options.batchSize) : 100
      
      // Read file content
      const content = readFileSync(file, 'utf-8')
      let items: any[] = []
      
      switch (format) {
        case 'json':
          items = JSON.parse(content)
          if (!Array.isArray(items)) {
            items = [items]
          }
          break
          
        case 'jsonl':
          items = content.split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line))
          break
          
        case 'csv':
          // Simple CSV parsing (first line is headers)
          const lines = content.split('\n').filter(line => line.trim())
          const headers = lines[0].split(',').map(h => h.trim())
          items = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim())
            const obj: any = {}
            headers.forEach((h, i) => {
              obj[h] = values[i]
            })
            return obj
          })
          break
      }
      
      spinner.text = `Importing ${items.length} items...`
      
      // Process in batches
      let imported = 0
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        
        for (const item of batch) {
          let content: string
          let metadata: any = {}
          
          if (typeof item === 'string') {
            content = item
          } else if (item.content || item.text) {
            content = item.content || item.text
            metadata = item.metadata || item
          } else {
            content = JSON.stringify(item)
            metadata = { originalData: item }
          }
          
          // Use AI to detect type for each item
          const suggestion = await BrainyTypes.suggestNoun(
            typeof content === 'string' ? { content, ...metadata } : content
          )
          
          // Use suggested type or default to Content if low confidence
          const nounType = suggestion.confidence >= 0.5 ? suggestion.type : NounType.Content
          
          await brain.add({
            data: content,
            type: nounType as NounType,
            metadata
          })
          imported++
        }
        
        spinner.text = `Imported ${imported}/${items.length} items...`
      }
      
      spinner.succeed(`Imported ${imported} items`)
      
      if (!options.json) {
        console.log(chalk.green(`✓ Successfully imported ${imported} items from ${file}`))
        console.log(chalk.dim(`  Format: ${format}`))
        console.log(chalk.dim(`  Batch size: ${batchSize}`))
      } else {
        formatOutput({ imported, file, format, batchSize }, options)
      }
    } catch (error: any) {
      spinner.fail('Import failed')
      console.error(chalk.red(error.message))
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
  }
}