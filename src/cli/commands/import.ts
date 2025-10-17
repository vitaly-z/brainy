/**
 * Import Commands - Neural Import & Data Import
 *
 * Complete import system exposing ALL Brainy import capabilities:
 * - UniversalImportAPI: Neural import with AI type matching
 * - DirectoryImporter: VFS directory imports
 * - DataAPI: Backup/restore
 *
 * Supports: files, directories, URLs, all formats
 */

import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { readFileSync, statSync, existsSync } from 'node:fs'
import { Brainy } from '../../brainy.js'
import { NounType } from '../../types/graphTypes.js'

interface ImportOptions {
  verbose?: boolean
  json?: boolean
  pretty?: boolean
  quiet?: boolean
  // Format options
  format?: 'json' | 'csv' | 'jsonl' | 'yaml' | 'markdown' | 'html' | 'xml' | 'text'
  // Import behavior
  recursive?: boolean
  batchSize?: string
  // Neural options
  extractConcepts?: boolean
  extractEntities?: boolean
  detectRelationships?: boolean
  confidence?: string
  // Progress
  progress?: boolean
  // Filtering
  skipHidden?: boolean
  skipNodeModules?: boolean
  // VFS options
  target?: string
  generateEmbeddings?: boolean
  extractMetadata?: boolean
}

let brainyInstance: Brainy | null = null

const getBrainy = (): Brainy => {
  if (!brainyInstance) {
    brainyInstance = new Brainy()
  }
  return brainyInstance
}

const formatOutput = (data: any, options: ImportOptions): void => {
  if (options.json) {
    console.log(options.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data))
  }
}

export const importCommands = {
  /**
   * Enhanced import using UniversalImportAPI
   * Supports files, directories, URLs, all formats
   */
  async import(source: string | undefined, options: ImportOptions) {
    let spinner: any = null
    try {
      // Interactive mode if no source provided
      if (!source) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'source',
            message: 'Import source (file, directory, or URL):',
            validate: (input: string) => input.trim().length > 0 || 'Source cannot be empty'
          },
          {
            type: 'confirm',
            name: 'recursive',
            message: 'Import directories recursively?',
            default: true,
            when: (ans: any) => {
              // Check if it's a directory
              try {
                return existsSync(ans.source) && statSync(ans.source).isDirectory()
              } catch {
                return false
              }
            }
          },
          {
            type: 'list',
            name: 'format',
            message: 'File format (auto-detect if not specified):',
            choices: ['auto', 'json', 'csv', 'jsonl', 'yaml', 'markdown', 'html', 'xml', 'text'],
            default: 'auto'
          },
          {
            type: 'confirm',
            name: 'extractConcepts',
            message: 'Extract concepts as entities?',
            default: false
          },
          {
            type: 'confirm',
            name: 'extractEntities',
            message: 'Extract named entities (NLP)?',
            default: false
          },
          {
            type: 'confirm',
            name: 'detectRelationships',
            message: 'Auto-detect relationships?',
            default: true
          },
          {
            type: 'confirm',
            name: 'progress',
            message: 'Show progress?',
            default: true
          }
        ])

        source = answers.source
        if (answers.recursive !== undefined) options.recursive = answers.recursive
        if (answers.format && answers.format !== 'auto') options.format = answers.format
        if (answers.extractConcepts) options.extractConcepts = true
        if (answers.extractEntities) options.extractEntities = true
        if (answers.detectRelationships !== undefined) options.detectRelationships = answers.detectRelationships
        if (answers.progress) options.progress = true
      }

      // Determine if it's a file, directory, or URL
      const isURL = source.startsWith('http://') || source.startsWith('https://')
      let isDirectory = false

      if (!isURL && existsSync(source)) {
        isDirectory = statSync(source).isDirectory()
      }

      if (isDirectory && !options.recursive) {
        console.log(chalk.yellow('⚠️  Source is a directory. Use --recursive to import subdirectories.'))
        const answer = await inquirer.prompt([{
          type: 'confirm',
          name: 'recursive',
          message: 'Import recursively?',
          default: true
        }])
        options.recursive = answer.recursive
      }

      spinner = ora('Initializing neural import...').start()
      const brain = getBrainy()

      // Load UniversalImportAPI
      const { UniversalImportAPI } = await import('../../api/UniversalImportAPI.js')
      const universalImport = new UniversalImportAPI(brain)
      await universalImport.init()

      spinner.text = 'Processing import...'

      // Handle different source types
      let result: any

      if (isURL) {
        // URL import
        spinner.text = `Fetching from ${source}...`
        result = await universalImport.importFromURL(source)
      } else if (isDirectory) {
        // Directory import - process each file
        spinner.text = `Scanning directory: ${source}...`

        const { promises: fs } = await import('node:fs')
        const { join } = await import('node:path')

        // Collect files
        const files: string[] = []
        const collectFiles = async (dir: string) => {
          const entries = await fs.readdir(dir, { withFileTypes: true })
          for (const entry of entries) {
            const fullPath = join(dir, entry.name)

            // Skip node_modules
            if (entry.name === 'node_modules' && options.skipNodeModules !== false) {
              continue
            }

            // Skip hidden files
            if (options.skipHidden && entry.name.startsWith('.')) {
              continue
            }

            if (entry.isFile()) {
              files.push(fullPath)
            } else if (entry.isDirectory() && options.recursive !== false) {
              await collectFiles(fullPath)
            }
          }
        }

        await collectFiles(source)

        spinner.succeed(`Found ${files.length} files`)

        // Process files in batches
        const batchSize = options.batchSize ? parseInt(options.batchSize) : 100
        let totalEntities = 0
        let totalRelationships = 0
        let filesProcessed = 0

        for (let i = 0; i < files.length; i += batchSize) {
          const batch = files.slice(i, i + batchSize)

          if (options.progress) {
            spinner = ora(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)} (${filesProcessed}/${files.length} files)...`).start()
          }

          for (const file of batch) {
            try {
              const fileResult = await universalImport.importFromFile(file)
              totalEntities += fileResult.stats.entitiesCreated
              totalRelationships += fileResult.stats.relationshipsCreated
              filesProcessed++
            } catch (error: any) {
              if (options.verbose) {
                console.log(chalk.yellow(`⚠️  Failed to import ${file}: ${error.message}`))
              }
            }
          }
        }

        result = {
          stats: {
            filesProcessed,
            entitiesCreated: totalEntities,
            relationshipsCreated: totalRelationships,
            totalProcessed: filesProcessed
          }
        }

        spinner.succeed('Directory import complete')
      } else {
        // File import
        result = await universalImport.importFromFile(source)
      }

      spinner.succeed('Import complete')

      // Post-processing: extract concepts if requested
      if (options.extractConcepts && result.entities && result.entities.length > 0) {
        spinner = ora('Extracting concepts...').start()
        let conceptsExtracted = 0

        for (const entity of result.entities) {
          try {
            const text = typeof entity.data === 'string' ? entity.data :
                        entity.data?.text || entity.data?.content || JSON.stringify(entity.data)

            const concepts = await brain.extractConcepts(text, {
              confidence: options.confidence ? parseFloat(options.confidence) : 0.5
            })

            // Add concepts as entities
            for (const concept of concepts) {
              await brain.add({
                data: concept,
                type: NounType.Concept,
                metadata: {
                  extractedFrom: entity.id,
                  extractionMethod: 'neural'
                }
              })
              conceptsExtracted++
            }
          } catch (error: any) {
            if (options.verbose) {
              console.log(chalk.dim(`Could not extract concepts from entity ${entity.id}`))
            }
          }
        }

        spinner.succeed(`Extracted ${conceptsExtracted} concepts`)
      }

      // Post-processing: extract entities if requested
      if (options.extractEntities && result.entities && result.entities.length > 0) {
        spinner = ora('Extracting named entities...').start()
        let entitiesExtracted = 0

        for (const entity of result.entities) {
          try {
            const text = typeof entity.data === 'string' ? entity.data :
                        entity.data?.text || entity.data?.content || JSON.stringify(entity.data)

            const extractedEntities = await brain.extract(text)

            // Add extracted entities
            for (const extracted of extractedEntities) {
              const type = (extracted as any).type || NounType.Thing
              await brain.add({
                data: (extracted as any).content || (extracted as any).text,
                type: type,
                metadata: {
                  extractedFrom: entity.id,
                  extractionMethod: 'nlp',
                  confidence: (extracted as any).confidence
                }
              })
              entitiesExtracted++
            }
          } catch (error: any) {
            if (options.verbose) {
              console.log(chalk.dim(`Could not extract entities from entity ${entity.id}`))
            }
          }
        }

        spinner.succeed(`Extracted ${entitiesExtracted} named entities`)
      }

      // Display results
      if (!options.json && !options.quiet) {
        console.log(chalk.cyan('\n📊 Import Results:\n'))

        console.log(chalk.bold('Statistics:'))
        console.log(`  Entities created: ${chalk.green(result.stats.entitiesCreated)}`)

        if (result.stats.relationshipsCreated > 0) {
          console.log(`  Relationships created: ${chalk.green(result.stats.relationshipsCreated)}`)
        }

        if (result.stats.filesProcessed) {
          console.log(`  Files processed: ${chalk.green(result.stats.filesProcessed)}`)
        }

        console.log(`  Average confidence: ${chalk.yellow((result.stats.averageConfidence * 100).toFixed(1))}%`)
        console.log(`  Processing time: ${chalk.dim(result.stats.processingTimeMs)}ms`)

        if (options.verbose && result.entities && result.entities.length > 0) {
          console.log(chalk.bold('\n📦 Imported Entities (first 10):'))
          result.entities.slice(0, 10).forEach((entity: any, i: number) => {
            console.log(`  ${i + 1}. ${chalk.cyan(entity.type)} (${(entity.confidence * 100).toFixed(1)}% confidence)`)
            const preview = typeof entity.data === 'string' ? entity.data : JSON.stringify(entity.data)
            console.log(chalk.dim(`     ${preview.substring(0, 60)}${preview.length > 60 ? '...' : ''}`))
          })

          if (result.entities.length > 10) {
            console.log(chalk.dim(`  ... and ${result.entities.length - 10} more entities`))
          }
        }

        if (options.verbose && result.relationships && result.relationships.length > 0) {
          console.log(chalk.bold('\n🔗 Detected Relationships (first 5):'))
          result.relationships.slice(0, 5).forEach((rel: any, i: number) => {
            console.log(`  ${i + 1}. ${chalk.dim(rel.from)} --[${chalk.green(rel.type)}]--> ${chalk.dim(rel.to)}`)
          })

          if (result.relationships.length > 5) {
            console.log(chalk.dim(`  ... and ${result.relationships.length - 5} more relationships`))
          }
        }

        console.log(chalk.cyan('\n✓ Neural import complete with AI type matching'))
      } else if (options.json) {
        formatOutput(result, options)
      }
    } catch (error: any) {
      if (spinner) spinner.fail('Import failed')
      console.error(chalk.red('Import failed:', error.message))
      if (options.verbose) {
        console.error(chalk.dim(error.stack))
      }
      process.exit(1)
    }
  },

  /**
   * VFS-specific import (files/directories into VFS)
   */
  async vfsImport(source: string | undefined, options: ImportOptions) {
    let spinner: any = null
    try {
      // Interactive mode if no source provided
      if (!source) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'source',
            message: 'Source path (file or directory):',
            validate: (input: string) => {
              if (!input.trim()) return 'Source cannot be empty'
              if (!existsSync(input)) return 'Path does not exist'
              return true
            }
          },
          {
            type: 'input',
            name: 'target',
            message: 'VFS target path:',
            default: '/'
          },
          {
            type: 'confirm',
            name: 'recursive',
            message: 'Import recursively?',
            default: true,
            when: (ans: any) => {
              try {
                return statSync(ans.source).isDirectory()
              } catch {
                return false
              }
            }
          },
          {
            type: 'confirm',
            name: 'generateEmbeddings',
            message: 'Generate embeddings for files?',
            default: true
          },
          {
            type: 'confirm',
            name: 'extractMetadata',
            message: 'Extract file metadata?',
            default: true
          }
        ])

        source = answers.source
        options.target = answers.target
        if (answers.recursive !== undefined) options.recursive = answers.recursive
        if (answers.generateEmbeddings !== undefined) options.generateEmbeddings = answers.generateEmbeddings
        if (answers.extractMetadata !== undefined) options.extractMetadata = answers.extractMetadata
      }

      spinner = ora('Initializing VFS import...').start()
      const brain = getBrainy()

      // Get VFS
      const vfs = await brain.vfs()

      // Load DirectoryImporter
      const { DirectoryImporter } = await import('../../vfs/importers/DirectoryImporter.js')
      const importer = new DirectoryImporter(vfs, brain)

      spinner.text = 'Importing to VFS...'

      // Import with progress tracking
      const importOptions = {
        targetPath: options.target || '/',
        recursive: options.recursive !== false,
        skipHidden: options.skipHidden || false,
        skipNodeModules: options.skipNodeModules !== false,
        batchSize: options.batchSize ? parseInt(options.batchSize) : 100,
        generateEmbeddings: options.generateEmbeddings !== false,
        extractMetadata: options.extractMetadata !== false,
        showProgress: options.progress || false
      }

      const result = await importer.import(source, importOptions)

      spinner.succeed('VFS import complete')

      // Display results
      if (!options.json && !options.quiet) {
        console.log(chalk.cyan('\n📁 VFS Import Results:\n'))

        console.log(chalk.bold('Statistics:'))
        console.log(`  Files imported: ${chalk.green(result.filesProcessed)}`)
        console.log(`  Directories created: ${chalk.green(result.directoriesCreated)}`)
        console.log(`  Total size: ${chalk.yellow(formatBytes(result.totalSize))}`)
        console.log(`  Duration: ${chalk.dim(result.duration)}ms`)

        if (result.failed.length > 0) {
          console.log(chalk.yellow(`  Failed: ${result.failed.length}`))

          if (options.verbose) {
            console.log(chalk.bold('\n⚠️  Failed Imports:'))
            result.failed.slice(0, 10).forEach((fail: any) => {
              console.log(`  ${chalk.dim(fail.path)}: ${chalk.red(fail.error.message)}`)
            })
            if (result.failed.length > 10) {
              console.log(chalk.dim(`  ... and ${result.failed.length - 10} more`))
            }
          }
        }

        if (options.verbose && result.imported.length > 0) {
          console.log(chalk.bold('\n✓ Imported Files (first 10):'))
          result.imported.slice(0, 10).forEach((path: string) => {
            console.log(`  ${chalk.green('✓')} ${chalk.dim(path)}`)
          })
          if (result.imported.length > 10) {
            console.log(chalk.dim(`  ... and ${result.imported.length - 10} more files`))
          }
        }

        console.log(chalk.cyan('\n✓ Files imported to VFS with embeddings'))
      } else if (options.json) {
        formatOutput(result, options)
      }
    } catch (error: any) {
      if (spinner) spinner.fail('VFS import failed')
      console.error(chalk.red('VFS import failed:', error.message))
      if (options.verbose) {
        console.error(chalk.dim(error.stack))
      }
      process.exit(1)
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
