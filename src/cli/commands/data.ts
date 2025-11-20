/**
 * Data Management Commands
 *
 * Import, export, and statistics operations
 */

import chalk from 'chalk'
import ora from 'ora'
import { readFileSync, writeFileSync } from 'node:fs'
import { Brainy } from '../../brainy.js'

interface DataOptions {
  verbose?: boolean
  json?: boolean
  pretty?: boolean
}

let brainyInstance: Brainy | null = null

const getBrainy = (): Brainy => {
  if (!brainyInstance) {
    brainyInstance = new Brainy()
  }
  return brainyInstance
}

const formatOutput = (data: any, options: DataOptions): void => {
  if (options.json) {
    console.log(options.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data))
  }
}

export const dataCommands = {
  /**
   * Get database statistics
   */
  async stats(options: DataOptions) {
    const spinner = ora('Gathering statistics...').start()

    try {
      const brain = getBrainy()
      const dataApi = await brain.data()

      const stats = await dataApi.getStats()

      spinner.succeed('Statistics gathered')

      if (!options.json) {
        console.log(chalk.cyan('\n📊 Database Statistics:\n'))

        console.log(chalk.bold('Entities:'))
        console.log(`  Total: ${chalk.green(stats.entities)}`)

        console.log(chalk.bold('\nRelationships:'))
        console.log(`  Total: ${chalk.green(stats.relations)}`)

        if ((stats as any).storageSize) {
          console.log(chalk.bold('\nStorage:'))
          console.log(`  Size: ${chalk.green(formatBytes((stats as any).storageSize))}`)
        }

        if ((stats as any).vectorDimensions) {
          console.log(chalk.bold('\nVector Index:'))
          console.log(`  Dimensions: ${(stats as any).vectorDimensions}`)
        }
      } else {
        formatOutput(stats, options)
      }
    } catch (error: any) {
      spinner.fail('Failed to get statistics')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}