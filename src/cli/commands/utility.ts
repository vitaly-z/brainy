/**
 * Utility CLI Commands - TypeScript Implementation
 * 
 * Database maintenance, statistics, and benchmarking
 */

import chalk from 'chalk'
import ora from 'ora'
import Table from 'cli-table3'
import { Brainy } from '../../brainy.js'
import { NounType } from '../../types/graphTypes.js'

interface UtilityOptions {
  verbose?: boolean
  json?: boolean
  pretty?: boolean
}

interface StatsOptions extends UtilityOptions {
  byService?: boolean
  detailed?: boolean
}

interface CleanOptions extends UtilityOptions {
  removeOrphans?: boolean
  rebuildIndex?: boolean
}

interface BenchmarkOptions extends UtilityOptions {
  operations?: string
  iterations?: string
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
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatOutput = (data: any, options: UtilityOptions): void => {
  if (options.json) {
    console.log(options.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data))
  }
}

export const utilityCommands = {
  /**
   * Show database statistics
   */
  async stats(options: StatsOptions) {
    const spinner = ora('Gathering statistics...').start()

    try {
      const brain = getBrainy()
      const nounCount = await brain.getNounCount()
      const verbCount = await brain.getVerbCount()
      const memUsage = process.memoryUsage()

      spinner.succeed('Statistics gathered')

      const stats = {
        nounCount,
        verbCount,
        totalItems: nounCount + verbCount
      }

      if (options.json) {
        formatOutput(stats, options)
        return
      }

      console.log(chalk.cyan('\n📊 Database Statistics\n'))

      // Core stats table
      const coreTable = new Table({
        head: [chalk.cyan('Metric'), chalk.cyan('Value')],
        style: { head: [], border: [] }
      })

      coreTable.push(
        ['Total Items', chalk.green(stats.totalItems)],
        ['Nouns', chalk.green(stats.nounCount)],
        ['Verbs (Relationships)', chalk.green(stats.verbCount)]
      )

      console.log(coreTable.toString())

      // Memory usage
      console.log(chalk.cyan('\n🧠 Memory Usage\n'))

      const memTable = new Table({
        head: [chalk.cyan('Type'), chalk.cyan('Size')],
        style: { head: [], border: [] }
      })

      memTable.push(
        ['Heap Used', formatBytes(memUsage.heapUsed)],
        ['Heap Total', formatBytes(memUsage.heapTotal)],
        ['RSS', formatBytes(memUsage.rss)],
        ['External', formatBytes(memUsage.external)]
      )

      console.log(memTable.toString())
      
    } catch (error: any) {
      spinner.fail('Failed to gather statistics')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * Clean and optimize database
   */
  async clean(options: CleanOptions) {
    const spinner = ora('Cleaning database...').start()

    try {
      const brain = getBrainy()

      // For now, only support full clear
      // removeOrphans and rebuildIndex would require new Brainy APIs
      if (options.removeOrphans || options.rebuildIndex) {
        spinner.warn('Advanced cleanup options not yet implemented')
        console.log(chalk.yellow('\n⚠️  Advanced cleanup features coming soon:'))
        console.log(chalk.dim('  • --remove-orphans: Remove disconnected items'))
        console.log(chalk.dim('  • --rebuild-index: Rebuild vector index'))
        console.log(chalk.dim('\nUse "brainy clean" without options to clear the database'))
        return
      }

      // Show warning before clearing
      console.log(chalk.yellow('\n⚠️  WARNING: This will permanently delete ALL data!'))
      const dataApi = await brain.data()

      // Clear all data
      spinner.text = 'Clearing all data...'
      await dataApi.clear({ entities: true, relations: true })

      spinner.succeed('Database cleared')

      if (!options.json) {
        console.log(chalk.green('\n✓ Database cleared successfully'))
        console.log(chalk.dim('  All nouns, verbs, and metadata have been removed'))
      } else {
        formatOutput({ cleared: true, success: true }, options)
      }
    } catch (error: any) {
      spinner.fail('Cleanup failed')
      console.error(chalk.red(error.message))
      process.exit(1)
    }
  },

  /**
   * Run performance benchmarks
   */
  async benchmark(options: BenchmarkOptions) {
    const operations = options.operations || 'all'
    const iterations = parseInt(options.iterations || '100')
    
    console.log(chalk.cyan(`\n🚀 Running Benchmarks (${iterations} iterations)\n`))
    
    const results: any = {
      operations: {},
      summary: {}
    }
    
    try {
      const brain = getBrainy()
      
      // Benchmark different operations
      const benchmarks = [
        { name: 'add', enabled: operations === 'all' || operations.includes('add') },
        { name: 'search', enabled: operations === 'all' || operations.includes('search') },
        { name: 'similarity', enabled: operations === 'all' || operations.includes('similarity') },
        { name: 'cluster', enabled: operations === 'all' || operations.includes('cluster') }
      ]
      
      for (const bench of benchmarks) {
        if (!bench.enabled) continue
        
        const spinner = ora(`Benchmarking ${bench.name}...`).start()
        const times: number[] = []
        
        for (let i = 0; i < iterations; i++) {
          const start = Date.now()
          
          switch (bench.name) {
            case 'add':
              await brain.add({ data: `Test item ${i}`, type: NounType.Thing, metadata: { benchmark: true } })
              break
            case 'search':
              await brain.find({ query: 'test', limit: 10 })
              break
            case 'similarity':
              const neural = brain.neural()
              await neural.similar('test1', 'test2')
              break
            case 'cluster':
              const neuralApi = brain.neural()
              await neuralApi.clusters()
              break
          }
          
          times.push(Date.now() - start)
        }
        
        // Calculate statistics
        const avg = times.reduce((a, b) => a + b, 0) / times.length
        const min = Math.min(...times)
        const max = Math.max(...times)
        const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)]
        
        results.operations[bench.name] = {
          avg: avg.toFixed(2),
          min,
          max,
          median,
          ops: (1000 / avg).toFixed(2)
        }
        
        spinner.succeed(`${bench.name}: ${avg.toFixed(2)}ms avg (${(1000 / avg).toFixed(2)} ops/sec)`)
      }
      
      // Calculate summary
      const totalOps: number = (Object.values(results.operations) as any[]).reduce((sum: number, op: any) =>
        sum + parseFloat(op.ops), 0)

      results.summary = {
        totalOperations: Object.keys(results.operations).length,
        averageOpsPerSec: totalOps > 0 ? (totalOps / Object.keys(results.operations).length).toFixed(2) : '0'
      }
      
      if (!options.json) {
        // Display results table
        console.log(chalk.cyan('\n📊 Benchmark Results\n'))
        
        const table = new Table({
          head: [
            chalk.cyan('Operation'),
            chalk.cyan('Avg (ms)'),
            chalk.cyan('Min (ms)'),
            chalk.cyan('Max (ms)'),
            chalk.cyan('Median (ms)'),
            chalk.cyan('Ops/sec')
          ],
          style: { head: [], border: [] }
        })
        
        Object.entries(results.operations).forEach(([op, stats]: [string, any]) => {
          table.push([
            op,
            stats.avg,
            stats.min,
            stats.max,
            stats.median,
            chalk.green(stats.ops)
          ])
        })
        
        console.log(table.toString())
        
        console.log(chalk.cyan('\n📈 Summary'))
        console.log(`  Operations tested: ${results.summary.totalOperations}`)
        console.log(`  Average throughput: ${chalk.green(results.summary.averageOpsPerSec)} ops/sec`)
      } else {
        formatOutput(results, options)
      }
      
    } catch (error: any) {
      console.error(chalk.red('Benchmark failed:'), error.message)
      process.exit(1)
    }
  }
}