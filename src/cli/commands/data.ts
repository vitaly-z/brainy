/**
 * Data Management Commands
 *
 * Backup, restore, import, export operations
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
   * Backup database
   */
  async backup(file: string, options: DataOptions & { compress?: boolean }) {
    const spinner = ora('Creating backup...').start()

    try {
      const brain = getBrainy()
      const dataApi = await brain.data()

      const backup = await dataApi.backup({
        compress: options.compress
      })

      spinner.text = 'Writing backup file...'

      // Write backup to file
      const content = typeof backup === 'string'
        ? backup
        : JSON.stringify(backup, null, options.pretty ? 2 : 0)

      writeFileSync(file, content)

      spinner.succeed('Backup created')

      if (!options.json) {
        console.log(chalk.green(`✓ Backup saved to: ${file}`))
        if ((backup as any).compressed) {
          console.log(chalk.dim(`  Original size: ${formatBytes((backup as any).originalSize)}`))
          console.log(chalk.dim(`  Compressed size: ${formatBytes((backup as any).compressedSize)}`))
          console.log(chalk.dim(`  Compression ratio: ${(((backup as any).compressedSize / (backup as any).originalSize) * 100).toFixed(1)}%`))
        }
      } else {
        formatOutput({ file, backup: true }, options)
      }
    } catch (error: any) {
      spinner.fail('Backup failed')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * Restore from backup
   */
  async restore(file: string, options: DataOptions & { merge?: boolean }) {
    const spinner = ora('Restoring from backup...').start()

    try {
      const brain = getBrainy()
      const dataApi = await brain.data()

      // Read backup file
      const content = readFileSync(file, 'utf-8')
      const backup = JSON.parse(content)

      // Restore
      await dataApi.restore({
        backup,
        merge: options.merge || false
      })

      spinner.succeed('Restore complete')

      if (!options.json) {
        console.log(chalk.green(`✓ Restored from: ${file}`))
        if (options.merge) {
          console.log(chalk.dim('  Mode: Merged with existing data'))
        } else {
          console.log(chalk.dim('  Mode: Replaced all data'))
        }
      } else {
        formatOutput({ file, restored: true }, options)
      }
    } catch (error: any) {
      spinner.fail('Restore failed')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

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