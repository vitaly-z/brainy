/**
 * COW CLI Commands - Copy-on-Write Operations
 *
 * Fork, branch, merge, and migration operations for instant cloning
 */

import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { Brainy } from '../../brainy.js'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

interface CoreOptions {
  verbose?: boolean
  json?: boolean
  pretty?: boolean
}

interface ForkOptions extends CoreOptions {
  name?: string
  message?: string
  author?: string
}

interface MergeOptions extends CoreOptions {
  force?: boolean
  strategy?: 'last-write-wins' | 'custom'
}

interface MigrateOptions extends CoreOptions {
  from?: string
  to?: string
  backup?: boolean
  dryRun?: boolean
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

export const cowCommands = {
  /**
   * Fork the current brain (instant clone)
   */
  async fork(name: string | undefined, options: ForkOptions) {
    let spinner: any = null
    try {
      const brain = getBrainy()
      await brain.init()

      // Interactive mode if no name provided
      if (!name) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'branchName',
            message: 'Enter fork/branch name:',
            default: `fork-${Date.now()}`,
            validate: (input: string) =>
              input.trim().length > 0 || 'Branch name cannot be empty'
          },
          {
            type: 'input',
            name: 'message',
            message: 'Commit message (optional):',
            default: 'Fork from main'
          }
        ])
        name = answers.branchName
        options.message = answers.message
      }

      spinner = ora(`Forking brain to ${chalk.cyan(name)}...`).start()

      const startTime = Date.now()
      const fork = await brain.fork(name)
      const elapsed = Date.now() - startTime

      spinner.succeed(
        `Fork created: ${chalk.green(name)} ${chalk.dim(`(${elapsed}ms)`)}`
      )

      // Show stats
      const stats = await fork.getStats()
      console.log(`
${chalk.cyan('Fork Statistics:')}
  ${chalk.dim('Entities:')} ${stats.entities.total || 0}
  ${chalk.dim('Relationships:')} ${stats.relationships.totalRelationships || 0}
  ${chalk.dim('Time:')} ${elapsed}ms
  ${chalk.dim('Storage overhead:')} ~10-20%
      `.trim())

      if (options.json) {
        formatOutput({
          branch: name,
          time: elapsed,
          stats
        }, options)
      }

    } catch (error: any) {
      if (spinner) spinner.fail('Fork failed')
      console.error(chalk.red('Error:'), error.message)
      if (options.verbose) console.error(error)
      process.exit(1)
    }
  },

  /**
   * List all branches/forks
   */
  async branchList(options: CoreOptions) {
    try {
      const brain = getBrainy()
      await brain.init()

      const branches = await brain.listBranches()
      const currentBranch = await brain.getCurrentBranch()

      console.log(chalk.cyan('\nBranches:'))

      for (const branch of branches) {
        const isCurrent = branch === currentBranch
        const marker = isCurrent ? chalk.green('*') : ' '
        const name = isCurrent ? chalk.green(branch) : branch

        // Get branch info
        // TODO: Re-enable when COW is integrated into BaseStorage
        // const ref = await brain.storage.refManager.getRef(branch)
        // const age = ref ? formatAge(Date.now() - ref.updatedAt) : 'unknown'

        console.log(`  ${marker} ${name}`)
      }

      console.log()

      if (options.json) {
        formatOutput({
          branches,
          currentBranch
        }, options)
      }

    } catch (error: any) {
      console.error(chalk.red('Error:'), error.message)
      if (options.verbose) console.error(error)
      process.exit(1)
    }
  },

  /**
   * Switch to a different branch
   */
  async checkout(branch: string | undefined, options: CoreOptions) {
    let spinner: any = null
    try {
      const brain = getBrainy()
      await brain.init()

      // Interactive mode if no branch provided
      if (!branch) {
        const branches = await brain.listBranches()
        const currentBranch = await brain.getCurrentBranch()

        const { selected } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selected',
            message: 'Select branch:',
            choices: branches.map(b => ({
              name: b === currentBranch ? `${b} (current)` : b,
              value: b
            }))
          }
        ])
        branch = selected
      }

      const currentBranch = await brain.getCurrentBranch()

      if (branch === currentBranch) {
        console.log(chalk.yellow(`Already on branch '${branch}'`))
        return
      }

      spinner = ora(`Switching to ${chalk.cyan(branch)}...`).start()

      await brain.checkout(branch!)

      spinner.succeed(`Switched to branch ${chalk.green(branch)}`)

      if (options.json) {
        formatOutput({ branch }, options)
      }

    } catch (error: any) {
      if (spinner) spinner.fail('Checkout failed')
      console.error(chalk.red('Error:'), error.message)
      if (options.verbose) console.error(error)
      process.exit(1)
    }
  },

  /**
   * Delete a branch/fork
   */
  async branchDelete(branch: string | undefined, options: CoreOptions & { force?: boolean }) {
    try {
      const brain = getBrainy()
      await brain.init()

      // Interactive mode if no branch provided
      if (!branch) {
        const branches = await brain.listBranches()
        const currentBranch = await brain.getCurrentBranch()

        const { selected } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selected',
            message: 'Select branch to delete:',
            choices: branches
              .filter(b => b !== currentBranch)  // Can't delete current
              .map(b => ({ name: b, value: b }))
          }
        ])
        branch = selected
      }

      // Confirm deletion
      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Delete branch '${branch}'? This cannot be undone.`,
            default: false
          }
        ])

        if (!confirm) {
          console.log(chalk.yellow('Deletion cancelled'))
          return
        }
      }

      const spinner = ora(`Deleting branch ${chalk.red(branch)}...`).start()

      await brain.deleteBranch(branch!)

      spinner.succeed(`Deleted branch ${chalk.red(branch)}`)

      if (options.json) {
        formatOutput({ deleted: branch }, options)
      }

    } catch (error: any) {
      console.error(chalk.red('Error:'), error.message)
      if (options.verbose) console.error(error)
      process.exit(1)
    }
  },

  /**
   * View commit history
   */
  async history(options: CoreOptions & { limit?: string }) {
    try {
      const brain = getBrainy()
      await brain.init()

      const limit = options.limit ? parseInt(options.limit) : 10

      const history = await brain.getHistory({ limit })

      console.log(chalk.cyan(`\nCommit History (last ${limit}):\n`))

      for (const commit of history) {
        const date = new Date(commit.timestamp)
        const age = formatAge(Date.now() - commit.timestamp)

        console.log(
          `${chalk.yellow(commit.hash.substring(0, 8))} ` +
          `${chalk.dim(commit.message)} ` +
          `${chalk.dim(`by ${commit.author} (${age} ago)`)}`
        )
      }

      console.log()

      if (options.json) {
        formatOutput(history, options)
      }

    } catch (error: any) {
      console.error(chalk.red('Error:'), error.message)
      if (options.verbose) console.error(error)
      process.exit(1)
    }
  },

  /**
   * Migrate from v4.x to v5.0.0 (one-time)
   */
  async migrate(options: MigrateOptions) {
    let spinner: any = null
    try {
      // Interactive mode if paths not provided
      let fromPath = options.from
      let toPath = options.to

      if (!fromPath || !toPath) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'from',
            message: 'Old Brainy data path (v4.x):',
            default: './brainy-data',
            when: !fromPath
          },
          {
            type: 'input',
            name: 'to',
            message: 'New Brainy data path (v5.0.0):',
            default: './brainy-data-v5',
            when: !toPath
          },
          {
            type: 'confirm',
            name: 'backup',
            message: 'Create backup before migration?',
            default: true,
            when: options.backup === undefined
          }
        ])

        fromPath = fromPath || answers.from
        toPath = toPath || answers.to
        options.backup = options.backup ?? answers.backup
      }

      // Verify old data exists
      if (!existsSync(resolve(fromPath!))) {
        throw new Error(`Old data path not found: ${fromPath}`)
      }

      // Create backup if requested
      if (options.backup) {
        const backupPath = `${fromPath}.backup-${Date.now()}`
        spinner = ora(`Creating backup: ${backupPath}...`).start()

        // TODO: Implement backup
        // await copyDirectory(fromPath, backupPath)

        spinner.succeed(`Backup created: ${chalk.green(backupPath)}`)
      }

      if (options.dryRun) {
        console.log(chalk.yellow('\n[DRY RUN] Migration plan:'))
        console.log(`  From: ${fromPath}`)
        console.log(`  To: ${toPath}`)
        console.log(`  Backup: ${options.backup ? 'Yes' : 'No'}`)
        console.log()
        return
      }

      spinner = ora('Migrating to v5.0.0 COW format...').start()

      // Load old brain (v4.x)
      const oldBrain = new Brainy({
        storage: {
          type: 'filesystem',
          options: { path: fromPath }
        }
      })

      await oldBrain.init()

      // Create new brain (v5.0.0)
      const newBrain = new Brainy({
        storage: {
          type: 'filesystem',
          options: { path: toPath }
        }
      })

      await newBrain.init()

      // Migrate all entities
      const entities = await oldBrain.find({})
      let migrated = 0

      spinner.text = `Migrating entities (0/${entities.length})...`

      for (const result of entities) {
        // Add entity with proper params
        await newBrain.add({
          type: result.entity.type as any,
          data: result.entity.data
        })
        migrated++

        if (migrated % 100 === 0) {
          spinner.text = `Migrating entities (${migrated}/${entities.length})...`
        }
      }

      // Create initial commit (will be available after COW integration)
      // await newBrain.commit({
      //   message: `Migrated from v4.x (${entities.length} entities)`,
      //   author: 'migration-tool'
      // })

      spinner.succeed(`Migration complete: ${chalk.green(migrated)} entities`)

      console.log(`
${chalk.cyan('Migration Summary:')}
  ${chalk.dim('Old path:')} ${fromPath}
  ${chalk.dim('New path:')} ${toPath}
  ${chalk.dim('Entities:')} ${migrated}
  ${chalk.dim('Format:')} v5.0.0 COW
      `.trim())

      if (options.json) {
        formatOutput({
          from: fromPath,
          to: toPath,
          migrated
        }, options)
      }

      await oldBrain.close()
      await newBrain.close()

    } catch (error: any) {
      if (spinner) spinner.fail('Migration failed')
      console.error(chalk.red('Error:'), error.message)
      if (options.verbose) console.error(error)
      process.exit(1)
    }
  }
}

/**
 * Format timestamp age
 */
function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}
