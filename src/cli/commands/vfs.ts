/**
 * VFS CLI Commands - Virtual File System Operations
 *
 * Complete filesystem-like interface for Brainy's VFS
 */

import chalk from 'chalk'
import ora from 'ora'
import Table from 'cli-table3'
import { readFileSync, writeFileSync } from 'node:fs'
import { Brainy } from '../../brainy.js'

interface VFSOptions {
  verbose?: boolean
  json?: boolean
  pretty?: boolean
}

let brainyInstance: Brainy | null = null

const getBrainy = async (): Promise<Brainy> => {
  if (!brainyInstance) {
    brainyInstance = new Brainy()
    await brainyInstance.init()  // Initialize brain (VFS auto-initialized here!)
  }
  return brainyInstance
}

const formatOutput = (data: any, options: VFSOptions): void => {
  if (options.json) {
    console.log(options.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data))
  }
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (date: Date): string => {
  return date.toLocaleString()
}

export const vfsCommands = {
  /**
   * Read file from VFS
   */
  async read(path: string, options: VFSOptions & { output?: string; encoding?: string }) {
    const spinner = ora('Reading file...').start()

    try {
      const brain = await getBrainy()  // Await async getBrainy
      // VFS auto-initialized, no need for vfs.init()
      const buffer = await brain.vfs.readFile(path, {
        encoding: options.encoding as any
      })

      spinner.succeed('File read successfully')

      if (options.output) {
        // Write to local filesystem
        writeFileSync(options.output, buffer)
        console.log(chalk.green(`✓ Saved to: ${options.output}`))
      } else if (!options.json) {
        // Display content
        console.log('\n' + buffer.toString())
      } else {
        formatOutput({ path, content: buffer.toString(), size: buffer.length }, options)
      }
    } catch (error: any) {
      spinner.fail('Failed to read file')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * Write file to VFS
   */
  async write(path: string, options: VFSOptions & { content?: string; file?: string; encoding?: string }) {
    const spinner = ora('Writing file...').start()

    try {
      const brain = await getBrainy()

      let data: string
      if (options.file) {
        // Read from local file
        data = readFileSync(options.file, 'utf-8')
      } else if (options.content) {
        data = options.content
      } else {
        spinner.fail('Must provide --content or --file')
        process.exit(1)
      }

      await brain.vfs.writeFile(path, data, {
        encoding: options.encoding as any
      })

      spinner.succeed('File written successfully')

      if (!options.json) {
        console.log(chalk.green(`✓ Written to: ${path}`))
        console.log(chalk.dim(`  Size: ${formatBytes(Buffer.byteLength(data))}`))
      } else {
        formatOutput({ path, size: Buffer.byteLength(data) }, options)
      }
    } catch (error: any) {
      spinner.fail('Failed to write file')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * List directory contents
   */
  async ls(path: string, options: VFSOptions & { long?: boolean; all?: boolean }) {
    const spinner = ora('Listing directory...').start()

    try {
      const brain = await getBrainy()

      const entries = await brain.vfs.readdir(path, { withFileTypes: true })

      spinner.succeed(`Found ${Array.isArray(entries) ? entries.length : 0} items`)

      if (!options.json) {
        if (!Array.isArray(entries) || entries.length === 0) {
          console.log(chalk.yellow('Directory is empty'))
          return
        }

        if (options.long) {
          // Long format with details
          const table = new Table({
            head: [chalk.cyan('Type'), chalk.cyan('Size'), chalk.cyan('Modified'), chalk.cyan('Name')],
            style: { head: [], border: [] }
          })

          for (const entry of entries as any[]) {
            if (!options.all && entry.name.startsWith('.')) continue

            const stat = await brain.vfs.stat(`${path}/${entry.name}`)
            table.push([
              entry.isDirectory() ? chalk.blue('DIR') : 'FILE',
              entry.isDirectory() ? '-' : formatBytes(stat.size),
              formatDate(stat.mtime),
              entry.name
            ])
          }

          console.log('\n' + table.toString())
        } else {
          // Simple format
          console.log()
          for (const entry of entries as any[]) {
            if (!options.all && entry.name.startsWith('.')) continue

            if (entry.isDirectory()) {
              console.log(chalk.blue(entry.name + '/'))
            } else {
              console.log(entry.name)
            }
          }
        }
      } else {
        formatOutput(entries, options)
      }
    } catch (error: any) {
      spinner.fail('Failed to list directory')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * Get file/directory stats
   */
  async stat(path: string, options: VFSOptions) {
    const spinner = ora('Getting file stats...').start()

    try {
      const brain = await getBrainy()

      const stats = await brain.vfs.stat(path)

      spinner.succeed('Stats retrieved')

      if (!options.json) {
        console.log(chalk.cyan('\nFile Statistics:'))
        console.log(`  Path: ${path}`)
        console.log(`  Type: ${stats.isDirectory() ? chalk.blue('Directory') : 'File'}`)
        console.log(`  Size: ${formatBytes(stats.size)}`)
        console.log(`  Created: ${formatDate(stats.birthtime)}`)
        console.log(`  Modified: ${formatDate(stats.mtime)}`)
        console.log(`  Accessed: ${formatDate(stats.atime)}`)
      } else {
        formatOutput(stats, options)
      }
    } catch (error: any) {
      spinner.fail('Failed to get stats')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * Create directory
   */
  async mkdir(path: string, options: VFSOptions & { parents?: boolean }) {
    const spinner = ora('Creating directory...').start()

    try {
      const brain = await getBrainy()

      await brain.vfs.mkdir(path, { recursive: options.parents })

      spinner.succeed('Directory created')

      if (!options.json) {
        console.log(chalk.green(`✓ Created: ${path}`))
      } else {
        formatOutput({ path, created: true }, options)
      }
    } catch (error: any) {
      spinner.fail('Failed to create directory')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * Remove file or directory
   */
  async rm(path: string, options: VFSOptions & { recursive?: boolean; force?: boolean }) {
    const spinner = ora('Removing...').start()

    try {
      const brain = await getBrainy()

      const stats = await brain.vfs.stat(path)

      if (stats.isDirectory()) {
        await brain.vfs.rmdir(path, { recursive: options.recursive })
      } else {
        await brain.vfs.unlink(path)
      }

      spinner.succeed('Removed successfully')

      if (!options.json) {
        console.log(chalk.green(`✓ Removed: ${path}`))
      } else {
        formatOutput({ path, removed: true }, options)
      }
    } catch (error: any) {
      spinner.fail('Failed to remove')
      console.error(chalk.red(error.message))
      if (!options.force) {
        process.exit(1)
      }
    }
  },

  /**
   * Search files by content
   */
  async search(query: string, options: VFSOptions & { path?: string; limit?: string; type?: string }) {
    const spinner = ora('Searching files...').start()

    try {
      const brain = await getBrainy()

      const results = await brain.vfs.search(query, {
        path: options.path,
        limit: options.limit ? parseInt(options.limit) : 10
      })

      spinner.succeed(`Found ${results.length} results`)

      if (!options.json) {
        if (results.length === 0) {
          console.log(chalk.yellow('No results found'))
        } else {
          console.log(chalk.cyan('\n📄 Search Results:\n'))

          results.forEach((result, i) => {
            console.log(chalk.bold(`${i + 1}. ${result.path}`))
            if (result.score) {
              console.log(chalk.dim(`   Score: ${(result.score * 100).toFixed(1)}%`))
            }
            if ((result as any).excerpt) {
              console.log(chalk.dim(`   ${(result as any).excerpt}`))
            }
            console.log()
          })
        }
      } else {
        formatOutput(results, options)
      }
    } catch (error: any) {
      spinner.fail('Search failed')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * Find similar files
   */
  async similar(path: string, options: VFSOptions & { limit?: string; threshold?: string }) {
    const spinner = ora('Finding similar files...').start()

    try {
      const brain = await getBrainy()

      const results = await brain.vfs.findSimilar(path, {
        limit: options.limit ? parseInt(options.limit) : 10,
        threshold: options.threshold ? parseFloat(options.threshold) : 0.7
      })

      spinner.succeed(`Found ${results.length} similar files`)

      if (!options.json) {
        if (results.length === 0) {
          console.log(chalk.yellow('No similar files found'))
        } else {
          console.log(chalk.cyan('\n🔗 Similar Files:\n'))

          results.forEach((result, i) => {
            console.log(chalk.bold(`${i + 1}. ${result.path}`))
            if (result.score) {
              console.log(chalk.green(`   Similarity: ${(result.score * 100).toFixed(1)}%`))
            }
            console.log()
          })
        }
      } else {
        formatOutput(results, options)
      }
    } catch (error: any) {
      spinner.fail('Failed to find similar files')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * Get directory tree structure
   */
  async tree(path: string, options: VFSOptions & { depth?: string }) {
    const spinner = ora('Building tree...').start()

    try {
      const brain = await getBrainy()

      const tree = await brain.vfs.getTreeStructure(path, {
        maxDepth: options.depth ? parseInt(options.depth) : 3
      })

      spinner.succeed('Tree built')

      if (!options.json) {
        console.log(chalk.cyan(`\n📁 ${path}\n`))
        displayTree(tree, '', true)
      } else {
        formatOutput(tree, options)
      }
    } catch (error: any) {
      spinner.fail('Failed to build tree')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  }
}

function displayTree(node: any, prefix: string, isLast: boolean) {
  const connector = isLast ? '└── ' : '├── '
  const name = node.isDirectory ? chalk.blue(node.name + '/') : node.name

  console.log(prefix + connector + name)

  if (node.children && node.children.length > 0) {
    const childPrefix = prefix + (isLast ? '    ' : '│   ')
    node.children.forEach((child: any, i: number) => {
      displayTree(child, childPrefix, i === node.children.length - 1)
    })
  }
}