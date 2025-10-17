/**
 * Insights & Analytics Commands
 *
 * Database insights, field statistics, and query optimization
 */

import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import Table from 'cli-table3'
import { Brainy } from '../../brainy.js'

interface InsightsOptions {
  verbose?: boolean
  json?: boolean
  pretty?: boolean
  quiet?: boolean
}

let brainyInstance: Brainy | null = null

const getBrainy = (): Brainy => {
  if (!brainyInstance) {
    brainyInstance = new Brainy()
  }
  return brainyInstance
}

const formatOutput = (data: any, options: InsightsOptions): void => {
  if (options.json) {
    console.log(options.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data))
  }
}

export const insightsCommands = {
  /**
   * Get comprehensive database insights
   */
  async insights(options: InsightsOptions) {
    const spinner = ora('Analyzing database...').start()

    try {
      const brain = getBrainy()

      // Get insights from Brainy
      const insights = await brain.insights()

      spinner.succeed('Analysis complete')

      if (!options.json) {
        console.log(chalk.cyan('\n📊 Database Insights:\n'))

        // Overview - using actual insights return type
        console.log(chalk.bold('Overview:'))
        console.log(`  Total Entities: ${chalk.yellow(insights.entities)}`)
        console.log(`  Total Relationships: ${chalk.yellow(insights.relationships)}`)
        console.log(`  Unique Types: ${chalk.yellow(Object.keys(insights.types).length)}`)
        console.log(`  Active Services: ${chalk.yellow(insights.services.join(', '))}`)
        console.log(`  Graph Density: ${chalk.yellow((insights.density * 100).toFixed(2))}%`)

        // Entity types breakdown
        const typeEntries = Object.entries(insights.types).sort((a, b) => b[1] - a[1])
        if (typeEntries.length > 0) {
          console.log(chalk.bold('\n🏆 Entities by Type:'))
          const typeTable = new Table({
            head: [chalk.cyan('Type'), chalk.cyan('Count'), chalk.cyan('Percentage')],
            colWidths: [25, 12, 15]
          })

          typeEntries.slice(0, 10).forEach(([type, count]) => {
            const percentage = insights.entities > 0 ? (count / insights.entities * 100) : 0
            typeTable.push([
              type,
              count.toString(),
              `${percentage.toFixed(1)}%`
            ])
          })

          console.log(typeTable.toString())

          if (typeEntries.length > 10) {
            console.log(chalk.dim(`\n... and ${typeEntries.length - 10} more types`))
          }
        }

        // Recommendations based on actual data
        console.log(chalk.bold('\n💡 Recommendations:'))
        if (insights.entities === 0) {
          console.log(`  ${chalk.yellow('→')} Database is empty - add entities to get started`)
        } else {
          if (insights.density < 0.1) {
            console.log(`  ${chalk.yellow('→')} Low graph density - consider adding more relationships`)
          }
          if (insights.relationships === 0) {
            console.log(`  ${chalk.yellow('→')} No relationships yet - use 'brainy relate' to connect entities`)
          }
          if (Object.keys(insights.types).length === 1) {
            console.log(`  ${chalk.yellow('→')} Only one entity type - consider adding diverse types for better organization`)
          }
        }

      } else {
        formatOutput(insights, options)
      }
    } catch (error: any) {
      spinner.fail('Failed to get insights')
      console.error(chalk.red('Insights failed:', error.message))
      if (options.verbose) {
        console.error(chalk.dim(error.stack))
      }
      process.exit(1)
    }
  },

  /**
   * Get available fields across all entities
   */
  async fields(options: InsightsOptions) {
    const spinner = ora('Analyzing fields...').start()

    try {
      const brain = getBrainy()

      // Get available fields from metadata index
      const fields = await brain.getAvailableFields()

      spinner.succeed(`Found ${fields.length} fields`)

      if (!options.json) {
        if (fields.length === 0) {
          console.log(chalk.yellow('\nNo metadata fields found'))
          console.log(chalk.dim('Add entities with metadata to see field statistics'))
        } else {
          console.log(chalk.cyan(`\n📋 Available Fields (${fields.length}):\n`))

          // Get statistics for each field
          const statistics = await brain.getFieldStatistics()

          const table = new Table({
            head: [chalk.cyan('Field'), chalk.cyan('Occurrences'), chalk.cyan('Unique Values')],
            colWidths: [30, 15, 20]
          })

          for (const field of fields.slice(0, 50)) {
            const stats = statistics.get(field)
            table.push([
              field,
              stats?.count || 0,
              stats?.uniqueValues || 0
            ])
          }

          console.log(table.toString())

          if (fields.length > 50) {
            console.log(chalk.dim(`\n... and ${fields.length - 50} more fields`))
          }

          console.log(chalk.dim('\n💡 Use --json to see all fields'))
        }
      } else {
        const statistics = await brain.getFieldStatistics()
        const fieldsWithStats = fields.map(field => ({
          field,
          ...Object.fromEntries(statistics.get(field) || [])
        }))
        formatOutput(fieldsWithStats, options)
      }
    } catch (error: any) {
      spinner.fail('Failed to get fields')
      console.error(chalk.red('Fields analysis failed:', error.message))
      if (options.verbose) {
        console.error(chalk.dim(error.stack))
      }
      process.exit(1)
    }
  },

  /**
   * Get field values for a specific field
   */
  async fieldValues(field: string | undefined, options: InsightsOptions & { limit?: string }) {
    let spinner: any = null
    try {
      // Interactive mode if no field provided
      if (!field) {
        spinner = ora('Getting available fields...').start()
        const brain = getBrainy()
        const availableFields = await brain.getAvailableFields()
        spinner.stop()

        const answer = await inquirer.prompt([{
          type: 'list',
          name: 'field',
          message: 'Select field:',
          choices: availableFields.slice(0, 50),
          pageSize: 15
        }])

        field = answer.field
      }

      spinner = ora(`Getting values for field: ${field}...`).start()
      const brain = getBrainy()

      const values = await brain.getFieldValues(field)
      const limit = options.limit ? parseInt(options.limit) : 100

      spinner.succeed(`Found ${values.length} unique values`)

      if (!options.json) {
        console.log(chalk.cyan(`\n🔍 Values for field "${chalk.bold(field)}":\n`))

        if (values.length === 0) {
          console.log(chalk.yellow('No values found for this field'))
        } else {
          // Group by value and count
          const valueCounts = values.reduce((acc: any, val: string) => {
            acc[val] = (acc[val] || 0) + 1
            return acc
          }, {})

          const sorted = Object.entries(valueCounts)
            .sort((a: any, b: any) => b[1] - a[1])
            .slice(0, limit)

          const table = new Table({
            head: [chalk.cyan('Value'), chalk.cyan('Count')],
            colWidths: [50, 12]
          })

          sorted.forEach(([value, count]) => {
            table.push([value, count.toString()])
          })

          console.log(table.toString())

          if (values.length > limit) {
            console.log(chalk.dim(`\n... and ${values.length - limit} more values (use --limit to show more)`))
          }
        }
      } else {
        formatOutput({ field, values, count: values.length }, options)
      }
    } catch (error: any) {
      if (spinner) spinner.fail('Failed to get field values')
      console.error(chalk.red('Field values failed:', error.message))
      if (options.verbose) {
        console.error(chalk.dim(error.stack))
      }
      process.exit(1)
    }
  },

  /**
   * Get optimal query plan for filters
   */
  async queryPlan(options: InsightsOptions & { filters?: string }) {
    let spinner: any = null
    try {
      let filters: Record<string, any> = {}

      // Interactive mode if no filters provided
      if (!options.filters) {
        const answer = await inquirer.prompt([{
          type: 'editor',
          name: 'filters',
          message: 'Enter filter JSON (e.g., {"status": "active", "priority": {"$gte": 5}}):',
          validate: (input: string) => {
            if (!input.trim()) return 'Filters cannot be empty'
            try {
              JSON.parse(input)
              return true
            } catch {
              return 'Invalid JSON format'
            }
          }
        }])

        filters = JSON.parse(answer.filters)
      } else {
        try {
          filters = JSON.parse(options.filters)
        } catch {
          console.error(chalk.red('Invalid JSON in --filters'))
          process.exit(1)
        }
      }

      spinner = ora('Analyzing optimal query plan...').start()
      const brain = getBrainy()

      const plan = await brain.getOptimalQueryPlan(filters)

      spinner.succeed('Query plan generated')

      if (!options.json) {
        console.log(chalk.cyan('\n🎯 Optimal Query Plan:\n'))

        console.log(chalk.bold('Filters:'))
        console.log(JSON.stringify(filters, null, 2))

        console.log(chalk.bold('\n📊 Query Execution Plan:'))
        console.log(`  Strategy: ${chalk.yellow(plan.strategy)}`)
        console.log(`  Estimated Cost: ${chalk.yellow(plan.estimatedCost)}`)

        if (plan.fieldOrder && plan.fieldOrder.length > 0) {
          console.log(chalk.bold('\n🔍 Field Processing Order (Optimized):'))
          plan.fieldOrder.forEach((field: string, index: number) => {
            console.log(`  ${index + 1}. ${chalk.green(field)}`)
          })
        }

        console.log(chalk.bold('\n💡 Strategy Explanation:'))
        if (plan.strategy === 'exact') {
          console.log(`  ${chalk.yellow('→')} Using exact-match indexing for fast lookups`)
        } else if (plan.strategy === 'range') {
          console.log(`  ${chalk.yellow('→')} Using range-based scanning for numeric/date filters`)
        } else if (plan.strategy === 'hybrid') {
          console.log(`  ${chalk.yellow('→')} Using hybrid approach combining multiple index types`)
        }

        console.log(chalk.bold('\n⚡ Performance Tips:'))
        console.log(`  ${chalk.yellow('→')} Lower estimated cost means faster queries`)
        console.log(`  ${chalk.yellow('→')} Fields are processed in optimal order`)
        console.log(`  ${chalk.yellow('→')} Consider adding indexes for frequently used fields`)

      } else {
        formatOutput({ filters, plan }, options)
      }
    } catch (error: any) {
      if (spinner) spinner.fail('Failed to generate query plan')
      console.error(chalk.red('Query plan failed:', error.message))
      if (options.verbose) {
        console.error(chalk.dim(error.stack))
      }
      process.exit(1)
    }
  }
}
