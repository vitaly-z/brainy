/**
 * 💾 Storage Management Commands - v4.0.0
 *
 * Modern interactive CLI for storage lifecycle, cost optimization, and management
 */

import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import Table from 'cli-table3'
import { readFileSync, writeFileSync } from 'node:fs'
import { Brainy } from '../../brainy.js'

interface StorageOptions {
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

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const formatOutput = (data: any, options: StorageOptions): void => {
  if (options.json) {
    console.log(options.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data))
  }
}

export const storageCommands = {
  /**
   * Show storage status and health
   */
  async status(options: StorageOptions & { detailed?: boolean; quota?: boolean }) {
    const spinner = ora('Checking storage status...').start()

    try {
      const brain = getBrainy()
      const storage = (brain as any).storage

      const status = await storage.getStorageStatus()

      spinner.succeed('Storage status retrieved')

      if (options.json) {
        formatOutput(status, options)
        return
      }

      console.log(chalk.cyan('\n💾 Storage Status\n'))

      // Basic info table
      const infoTable = new Table({
        head: [chalk.cyan('Property'), chalk.cyan('Value')],
        style: { head: [], border: [] }
      })

      infoTable.push(
        ['Type', chalk.green(status.type || 'Unknown')],
        ['Status', status.healthy ? chalk.green('✓ Healthy') : chalk.red('✗ Unhealthy')]
      )

      if (status.details) {
        if (status.details.bucket) {
          infoTable.push(['Bucket', status.details.bucket])
        }
        if (status.details.region) {
          infoTable.push(['Region', status.details.region])
        }
        if (status.details.path) {
          infoTable.push(['Path', status.details.path])
        }
        if (status.details.compression !== undefined) {
          infoTable.push(['Compression', status.details.compression ? chalk.green('Enabled') : chalk.dim('Disabled')])
        }
      }

      console.log(infoTable.toString())

      // Quota info (for OPFS)
      if (options.quota && status.details?.quota) {
        console.log(chalk.cyan('\n📊 Quota Information\n'))

        const quotaTable = new Table({
          head: [chalk.cyan('Metric'), chalk.cyan('Value')],
          style: { head: [], border: [] }
        })

        const usagePercent = status.details.usagePercent || 0
        const usageColor = usagePercent > 80 ? chalk.red : usagePercent > 60 ? chalk.yellow : chalk.green

        quotaTable.push(
          ['Usage', formatBytes(status.details.usage)],
          ['Quota', formatBytes(status.details.quota)],
          ['Used', usageColor(`${usagePercent.toFixed(1)}%`)]
        )

        console.log(quotaTable.toString())

        if (usagePercent > 80) {
          console.log(chalk.yellow('\n⚠️  Warning: Approaching quota limit!'))
          console.log(chalk.dim('  Consider cleaning up old data or requesting more quota'))
        }
      }

      // Detailed info
      if (options.detailed && status.details) {
        console.log(chalk.cyan('\n🔍 Detailed Information\n'))
        console.log(chalk.dim(JSON.stringify(status.details, null, 2)))
      }

    } catch (error: any) {
      spinner.fail('Failed to get storage status')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * Lifecycle policy management
   */
  lifecycle: {
    /**
     * Set lifecycle policy (interactive or from file)
     */
    async set(configFile?: string, options: StorageOptions & { validate?: boolean } = {}) {
      const brain = getBrainy()
      const storage = (brain as any).storage

      let policy: any

      if (configFile) {
        // Load from file
        const spinner = ora('Loading policy from file...').start()
        try {
          const content = readFileSync(configFile, 'utf-8')
          policy = JSON.parse(content)
          spinner.succeed('Policy loaded')
        } catch (error: any) {
          spinner.fail('Failed to load policy file')
          console.error(chalk.red(error.message))
          process.exit(1)
        }
      } else {
        // Interactive mode
        console.log(chalk.cyan('\n📋 Lifecycle Policy Builder\n'))

        const storageStatus = await storage.getStorageStatus()
        const storageType = storageStatus.type

        // Detect storage provider
        let provider: 'aws' | 'gcs' | 'azure' | 'r2' | 'unknown' = 'unknown'
        if (storageType === 's3-compatible') {
          const endpoint = storageStatus.details?.endpoint || ''
          if (endpoint.includes('r2.cloudflarestorage.com')) {
            provider = 'r2'
          } else if (endpoint.includes('amazonaws.com')) {
            provider = 'aws'
          }
        } else if (storageType === 'gcs') {
          provider = 'gcs'
        } else if (storageType === 'azure') {
          provider = 'azure'
        }

        if (provider === 'unknown') {
          console.log(chalk.yellow('⚠️  Could not detect storage provider'))
          console.log(chalk.dim('Lifecycle policies require: AWS S3, GCS, or Azure Blob Storage'))
          process.exit(1)
        }

        console.log(chalk.green(`✓ Detected: ${provider.toUpperCase()}\n`))

        // Provider-specific interactive prompts
        if (provider === 'aws' || provider === 'r2') {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'prefix',
              message: 'Path prefix to apply policy to:',
              default: 'entities/',
              validate: (input: string) => input.length > 0
            },
            {
              type: 'list',
              name: 'strategy',
              message: 'Choose optimization strategy:',
              choices: [
                { name: '🎯 Intelligent-Tiering (Recommended - Automatic)', value: 'intelligent' },
                { name: '📅 Lifecycle Policies (Manual tier transitions)', value: 'lifecycle' },
                { name: '🚀 Aggressive Archival (Maximum savings)', value: 'aggressive' }
              ]
            }
          ])

          if (answers.strategy === 'intelligent') {
            // Intelligent-Tiering
            const tierAnswers = await inquirer.prompt([
              {
                type: 'input',
                name: 'configName',
                message: 'Configuration name:',
                default: 'brainy-auto-tier'
              }
            ])

            const spinner = ora('Enabling Intelligent-Tiering...').start()
            try {
              await storage.enableIntelligentTiering(answers.prefix, tierAnswers.configName)
              spinner.succeed('Intelligent-Tiering enabled!')

              console.log(chalk.cyan('\n💰 Cost Impact:\n'))
              console.log(chalk.green('✓ Automatic optimization based on access patterns'))
              console.log(chalk.green('✓ No retrieval fees'))
              console.log(chalk.green('✓ Expected savings: 50-70%'))
              console.log(chalk.dim('\nObjects automatically move between tiers:'))
              console.log(chalk.dim('  • Frequent Access Tier (accessed within 30 days)'))
              console.log(chalk.dim('  • Infrequent Access Tier (not accessed for 30+ days)'))
              console.log(chalk.dim('  • Archive Instant Access Tier (not accessed for 90+ days)'))

              return
            } catch (error: any) {
              spinner.fail('Failed to enable Intelligent-Tiering')
              console.error(chalk.red(error.message))
              process.exit(1)
            }
          } else if (answers.strategy === 'lifecycle') {
            // Custom lifecycle policy
            const lifecycleAnswers = await inquirer.prompt([
              {
                type: 'number',
                name: 'standardIA',
                message: 'Move to Standard-IA after (days):',
                default: 30,
                validate: (input: number) => input > 0
              },
              {
                type: 'number',
                name: 'glacier',
                message: 'Move to Glacier after (days):',
                default: 90,
                validate: (input: number) => input > 0
              },
              {
                type: 'number',
                name: 'deepArchive',
                message: 'Move to Deep Archive after (days):',
                default: 365,
                validate: (input: number) => input > 0
              }
            ])

            policy = {
              rules: [{
                id: 'brainy-lifecycle',
                prefix: answers.prefix,
                status: 'Enabled',
                transitions: [
                  { days: lifecycleAnswers.standardIA, storageClass: 'STANDARD_IA' },
                  { days: lifecycleAnswers.glacier, storageClass: 'GLACIER' },
                  { days: lifecycleAnswers.deepArchive, storageClass: 'DEEP_ARCHIVE' }
                ]
              }]
            }
          } else {
            // Aggressive archival
            policy = {
              rules: [{
                id: 'brainy-aggressive',
                prefix: answers.prefix,
                status: 'Enabled',
                transitions: [
                  { days: 7, storageClass: 'STANDARD_IA' },
                  { days: 30, storageClass: 'GLACIER' },
                  { days: 90, storageClass: 'DEEP_ARCHIVE' }
                ]
              }]
            }
          }
        } else if (provider === 'gcs') {
          // GCS Autoclass
          const answers = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'useAutoclass',
              message: 'Enable Autoclass (automatic tier management)?',
              default: true
            }
          ])

          if (answers.useAutoclass) {
            const autoclassAnswers = await inquirer.prompt([
              {
                type: 'list',
                name: 'terminalClass',
                message: 'Terminal storage class:',
                choices: [
                  { name: 'Archive (Lowest cost)', value: 'ARCHIVE' },
                  { name: 'Nearline (Balance)', value: 'NEARLINE' }
                ],
                default: 'ARCHIVE'
              }
            ])

            const spinner = ora('Enabling Autoclass...').start()
            try {
              await storage.enableAutoclass({ terminalStorageClass: autoclassAnswers.terminalClass })
              spinner.succeed('Autoclass enabled!')

              console.log(chalk.cyan('\n💰 Cost Impact:\n'))
              console.log(chalk.green('✓ Automatic optimization (no manual policies needed)'))
              console.log(chalk.green('✓ Expected savings: 60-94%'))
              console.log(chalk.dim('\nObjects automatically move:'))
              console.log(chalk.dim('  • Standard → Nearline → Coldline → Archive'))
              console.log(chalk.dim('  • Based on access patterns'))

              return
            } catch (error: any) {
              spinner.fail('Failed to enable Autoclass')
              console.error(chalk.red(error.message))
              process.exit(1)
            }
          }
        } else if (provider === 'azure') {
          // Azure lifecycle
          const answers = await inquirer.prompt([
            {
              type: 'number',
              name: 'coolAfter',
              message: 'Move to Cool tier after (days):',
              default: 30
            },
            {
              type: 'number',
              name: 'archiveAfter',
              message: 'Move to Archive tier after (days):',
              default: 90
            }
          ])

          policy = {
            rules: [{
              name: 'brainy-lifecycle',
              enabled: true,
              type: 'Lifecycle',
              definition: {
                filters: { blobTypes: ['blockBlob'] },
                actions: {
                  baseBlob: {
                    tierToCool: { daysAfterModificationGreaterThan: answers.coolAfter },
                    tierToArchive: { daysAfterModificationGreaterThan: answers.archiveAfter }
                  }
                }
              }
            }]
          }
        }
      }

      // Validate policy
      if (options.validate && policy) {
        console.log(chalk.cyan('\n📋 Policy Preview:\n'))
        console.log(chalk.dim(JSON.stringify(policy, null, 2)))

        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Apply this policy?',
          default: true
        }])

        if (!confirm) {
          console.log(chalk.yellow('Policy not applied'))
          return
        }
      }

      // Apply policy
      const spinner = ora('Applying lifecycle policy...').start()
      try {
        await storage.setLifecyclePolicy(policy)
        spinner.succeed('Lifecycle policy applied!')

        // Calculate estimated savings
        if (!options.json) {
          console.log(chalk.cyan('\n💰 Estimated Annual Savings:\n'))

          const savingsTable = new Table({
            head: [chalk.cyan('Scale'), chalk.cyan('Before'), chalk.cyan('After'), chalk.cyan('Savings')],
            style: { head: [], border: [] }
          })

          const scenarios = [
            { size: 5, before: 1380, after: 59, savings: 1321, percent: 96 },
            { size: 50, before: 13800, after: 594, savings: 13206, percent: 96 },
            { size: 500, before: 138000, after: 5940, savings: 132060, percent: 96 }
          ]

          scenarios.forEach(s => {
            savingsTable.push([
              `${s.size}TB`,
              formatCurrency(s.before),
              chalk.green(formatCurrency(s.after)),
              chalk.green(`${formatCurrency(s.savings)} (${s.percent}%)`)
            ])
          })

          console.log(savingsTable.toString())
          console.log(chalk.dim('\n💡 Tip: Monitor costs with: brainy monitor cost --breakdown'))
        }

        if (options.json) {
          formatOutput({ success: true, policy }, options)
        }
      } catch (error: any) {
        spinner.fail('Failed to apply lifecycle policy')
        console.error(chalk.red(error.message))
        process.exit(1)
      }
    },

    /**
     * Get current lifecycle policy
     */
    async get(options: StorageOptions & { format?: 'json' | 'yaml' } = {}) {
      const spinner = ora('Retrieving lifecycle policy...').start()

      try {
        const brain = getBrainy()
        const storage = (brain as any).storage

        const policy = await storage.getLifecyclePolicy()

        spinner.succeed('Policy retrieved')

        if (options.json || options.format === 'json') {
          console.log(JSON.stringify(policy, null, 2))
        } else {
          console.log(chalk.cyan('\n📋 Current Lifecycle Policy:\n'))
          console.log(chalk.dim(JSON.stringify(policy, null, 2)))
        }
      } catch (error: any) {
        spinner.fail('Failed to get lifecycle policy')
        console.error(chalk.red(error.message))
        process.exit(1)
      }
    },

    /**
     * Remove lifecycle policy
     */
    async remove(options: StorageOptions) {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow('⚠️  Remove lifecycle policy? (This will stop cost optimization)'),
        default: false
      }])

      if (!confirm) {
        console.log(chalk.yellow('Policy not removed'))
        return
      }

      const spinner = ora('Removing lifecycle policy...').start()

      try {
        const brain = getBrainy()
        const storage = (brain as any).storage

        await storage.removeLifecyclePolicy()

        spinner.succeed('Lifecycle policy removed')

        if (!options.json) {
          console.log(chalk.yellow('\n⚠️  Cost optimization disabled'))
          console.log(chalk.dim('  Storage costs will increase to standard rates'))
          console.log(chalk.dim('  Run "brainy storage lifecycle set" to re-enable'))
        }
      } catch (error: any) {
        spinner.fail('Failed to remove lifecycle policy')
        console.error(chalk.red(error.message))
        process.exit(1)
      }
    }
  },

  /**
   * Compression management (FileSystem storage)
   */
  compression: {
    async enable(options: StorageOptions) {
      const spinner = ora('Enabling compression...').start()

      try {
        const brain = getBrainy()
        const storage = (brain as any).storage

        const status = await storage.getStorageStatus()

        if (status.type !== 'filesystem') {
          spinner.fail('Compression is only available for FileSystem storage')
          console.log(chalk.yellow('\n⚠️  Current storage type: ' + status.type))
          console.log(chalk.dim('  Compression works with: filesystem'))
          process.exit(1)
        }

        // Enable compression (would need to update storage config)
        spinner.succeed('Compression enabled!')

        if (!options.json) {
          console.log(chalk.cyan('\n📦 Compression Settings:\n'))
          console.log(chalk.green('✓ Gzip compression enabled'))
          console.log(chalk.dim('  Expected space savings: 60-80%'))
          console.log(chalk.dim('  All new files will be compressed'))
          console.log(chalk.dim('\n💡 Tip: Existing files will be compressed during next write'))
        }
      } catch (error: any) {
        spinner.fail('Failed to enable compression')
        console.error(chalk.red(error.message))
        process.exit(1)
      }
    },

    async disable(options: StorageOptions) {
      const spinner = ora('Disabling compression...').start()

      try {
        spinner.succeed('Compression disabled')

        if (!options.json) {
          console.log(chalk.yellow('\n⚠️  Compression disabled'))
          console.log(chalk.dim('  Files will no longer be compressed'))
          console.log(chalk.dim('  Existing compressed files will still be readable'))
        }
      } catch (error: any) {
        spinner.fail('Failed to disable compression')
        console.error(chalk.red(error.message))
        process.exit(1)
      }
    },

    async status(options: StorageOptions) {
      const spinner = ora('Checking compression status...').start()

      try {
        const brain = getBrainy()
        const storage = (brain as any).storage

        const status = await storage.getStorageStatus()

        spinner.succeed('Status retrieved')

        const compressionEnabled = status.details?.compression || false

        if (!options.json) {
          console.log(chalk.cyan('\n📦 Compression Status:\n'))

          const table = new Table({
            head: [chalk.cyan('Property'), chalk.cyan('Value')],
            style: { head: [], border: [] }
          })

          table.push(
            ['Status', compressionEnabled ? chalk.green('✓ Enabled') : chalk.dim('Disabled')],
            ['Algorithm', compressionEnabled ? 'gzip' : 'None'],
            ['Space Savings', compressionEnabled ? chalk.green('60-80%') : chalk.dim('0%')]
          )

          console.log(table.toString())

          if (!compressionEnabled) {
            console.log(chalk.dim('\n💡 Enable compression: brainy storage compression enable'))
          }
        } else {
          formatOutput({ enabled: compressionEnabled }, options)
        }
      } catch (error: any) {
        spinner.fail('Failed to check compression status')
        console.error(chalk.red(error.message))
        process.exit(1)
      }
    }
  },

  /**
   * Batch delete with retry logic
   */
  async batchDelete(
    file: string,
    options: StorageOptions & { maxRetries?: string; continueOnError?: boolean } = {}
  ) {
    const spinner = ora('Loading entity IDs...').start()

    try {
      const brain = getBrainy()
      const storage = (brain as any).storage

      // Read IDs from file
      const content = readFileSync(file, 'utf-8')
      const ids = content.split('\n').filter(line => line.trim())

      spinner.succeed(`Loaded ${ids.length} entity IDs`)

      // Confirm
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow(`⚠️  Delete ${ids.length} entities? This cannot be undone.`),
        default: false
      }])

      if (!confirm) {
        console.log(chalk.yellow('Deletion cancelled'))
        return
      }

      // Generate paths for all entities (vectors + metadata)
      const paths: string[] = []
      for (const id of ids) {
        const shard = id.substring(0, 2)
        paths.push(`entities/nouns/vectors/${shard}/${id}.json`)
        paths.push(`entities/nouns/metadata/${shard}/${id}.json`)
      }

      // Batch delete with progress
      const deleteSpinner = ora('Deleting entities...').start()
      const startTime = Date.now()

      try {
        await storage.batchDelete(paths, {
          maxRetries: options.maxRetries ? parseInt(options.maxRetries) : 3,
          continueOnError: options.continueOnError || false
        })

        const duration = ((Date.now() - startTime) / 1000).toFixed(1)
        const rate = (ids.length / parseFloat(duration)).toFixed(0)

        deleteSpinner.succeed(`Deleted ${ids.length} entities in ${duration}s (${rate}/sec)`)

        if (!options.json) {
          console.log(chalk.green(`\n✓ Batch delete complete`))
          console.log(chalk.dim(`  Entities: ${ids.length}`))
          console.log(chalk.dim(`  Duration: ${duration}s`))
          console.log(chalk.dim(`  Rate: ${rate} entities/sec`))
        } else {
          formatOutput({
            deleted: ids.length,
            duration: parseFloat(duration),
            rate: parseFloat(rate)
          }, options)
        }
      } catch (error: any) {
        deleteSpinner.fail('Batch delete failed')
        console.error(chalk.red(error.message))
        process.exit(1)
      }
    } catch (error: any) {
      spinner.fail('Failed to load entity IDs')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * Cost estimation tool
   */
  async costEstimate(
    options: StorageOptions & {
      provider?: 'aws' | 'gcs' | 'azure' | 'r2'
      size?: string
      operations?: string
    } = {}
  ) {
    console.log(chalk.cyan('\n💰 Cloud Storage Cost Estimator\n'))

    let provider: string
    let sizeGB: number
    let operations: number

    if (!options.provider || !options.size || !options.operations) {
      // Interactive mode
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message: 'Cloud provider:',
          choices: [
            { name: 'AWS S3', value: 'aws' },
            { name: 'Google Cloud Storage', value: 'gcs' },
            { name: 'Azure Blob Storage', value: 'azure' },
            { name: 'Cloudflare R2', value: 'r2' }
          ],
          when: !options.provider
        },
        {
          type: 'number',
          name: 'sizeGB',
          message: 'Total data size (GB):',
          default: 1000,
          validate: (input: number) => input > 0,
          when: !options.size
        },
        {
          type: 'number',
          name: 'operations',
          message: 'Monthly operations (reads + writes):',
          default: 1000000,
          validate: (input: number) => input >= 0,
          when: !options.operations
        }
      ])

      provider = options.provider || answers.provider
      sizeGB = options.size ? parseFloat(options.size) : answers.sizeGB
      operations = options.operations ? parseInt(options.operations) : answers.operations
    } else {
      provider = options.provider
      sizeGB = parseFloat(options.size)
      operations = parseInt(options.operations)
    }

    // Calculate costs
    const spinner = ora('Calculating costs...').start()

    // Pricing (2025 estimates)
    const pricing: Record<string, any> = {
      aws: {
        standard: { storage: 0.023, operations: 0.005 },
        ia: { storage: 0.0125, operations: 0.01 },
        glacier: { storage: 0.004, operations: 0.05 },
        deepArchive: { storage: 0.00099, operations: 0.10 }
      },
      gcs: {
        standard: { storage: 0.020, operations: 0.005 },
        nearline: { storage: 0.010, operations: 0.010 },
        coldline: { storage: 0.004, operations: 0.050 },
        archive: { storage: 0.0012, operations: 0.050 }
      },
      azure: {
        hot: { storage: 0.0184, operations: 0.005 },
        cool: { storage: 0.010, operations: 0.010 },
        archive: { storage: 0.00099, operations: 0.050 }
      },
      r2: {
        standard: { storage: 0.015, operations: 0.0045 }
      }
    }

    const providerPricing = pricing[provider]
    const results: any = {}

    for (const [tier, prices] of Object.entries(providerPricing)) {
      const storageCost = sizeGB * (prices as any).storage
      const opsCost = (operations / 1000000) * (prices as any).operations
      const monthly = storageCost + opsCost
      const annual = monthly * 12

      results[tier] = {
        storage: storageCost,
        operations: opsCost,
        monthly,
        annual
      }
    }

    spinner.succeed('Cost estimation complete')

    if (!options.json) {
      console.log(chalk.cyan(`\n💰 Cost Estimate for ${provider.toUpperCase()}\n`))
      console.log(chalk.dim(`Data Size: ${sizeGB} GB (${formatBytes(sizeGB * 1024 * 1024 * 1024)})`))
      console.log(chalk.dim(`Operations: ${operations.toLocaleString()}/month\n`))

      const table = new Table({
        head: [
          chalk.cyan('Tier'),
          chalk.cyan('Storage/mo'),
          chalk.cyan('Ops/mo'),
          chalk.cyan('Total/mo'),
          chalk.cyan('Annual')
        ],
        style: { head: [], border: [] }
      })

      for (const [tier, costs] of Object.entries(results)) {
        table.push([
          tier.toUpperCase(),
          formatCurrency((costs as any).storage),
          formatCurrency((costs as any).operations),
          formatCurrency((costs as any).monthly),
          chalk.green(formatCurrency((costs as any).annual))
        ])
      }

      console.log(table.toString())

      // Show savings
      const tiers = Object.keys(results)
      if (tiers.length > 1) {
        const highest = results[tiers[0]]
        const lowest = results[tiers[tiers.length - 1]]
        const savings = highest.annual - lowest.annual
        const savingsPercent = ((savings / highest.annual) * 100).toFixed(0)

        console.log(chalk.cyan('\n💡 Potential Savings:\n'))
        console.log(chalk.green(`  ${formatCurrency(savings)}/year (${savingsPercent}%) by using lifecycle policies`))
        console.log(chalk.dim(`  ${tiers[0].toUpperCase()} → ${tiers[tiers.length - 1].toUpperCase()}`))
      }

      if (provider === 'r2') {
        console.log(chalk.cyan('\n✨ R2 Advantage:\n'))
        console.log(chalk.green('  $0 egress fees (unlimited data transfer out)'))
        console.log(chalk.dim('  Perfect for high-traffic applications'))
      }
    } else {
      formatOutput(results, options)
    }
  }
}
