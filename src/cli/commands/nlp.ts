/**
 * NLP Commands - Natural Language Processing
 *
 * Extract entities, concepts, and insights from text using Brainy's neural NLP
 */

import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import Table from 'cli-table3'
import { Brainy } from '../../brainy.js'

interface NLPOptions {
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

const formatOutput = (data: any, options: NLPOptions): void => {
  if (options.json) {
    console.log(options.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data))
  }
}

export const nlpCommands = {
  /**
   * Extract entities from text
   */
  async extract(text: string | undefined, options: NLPOptions) {
    let spinner: any = null
    try {
      // Interactive mode if no text provided
      if (!text) {
        const answers = await inquirer.prompt([
          {
            type: 'editor',
            name: 'text',
            message: 'Enter or paste text to analyze (will open editor):',
            validate: (input: string) => input.trim().length > 0 || 'Text cannot be empty'
          },
          {
            type: 'confirm',
            name: 'saveEntities',
            message: 'Save extracted entities to database?',
            default: false
          }
        ])

        text = answers.text
        options = { ...options, ...(answers.saveEntities && { save: true }) }
      }

      spinner = ora('Extracting entities with neural NLP...').start()
      const brain = getBrainy()

      // Extract entities using Brainy's neural entity extractor
      const entities = await brain.extract(text)

      spinner.succeed(`Extracted ${entities.length} entities`)

      if (!options.json) {
        if (entities.length === 0) {
          console.log(chalk.yellow('\nNo entities found'))
          console.log(chalk.dim('Try providing more specific or detailed text'))
        } else {
          console.log(chalk.cyan(`\n🧠 Extracted ${entities.length} Entities:\n`))

          const table = new Table({
            head: [chalk.cyan('Type'), chalk.cyan('Entity'), chalk.cyan('Confidence')],
            colWidths: [15, 40, 15]
          })

          entities.forEach((entity: any) => {
            table.push([
              entity.type || 'Unknown',
              entity.content || entity.text || entity.value,
              `${((entity.confidence || 0) * 100).toFixed(1)}%`
            ])
          })

          console.log(table.toString())

          // Show summary by type
          const byType = entities.reduce((acc: any, e: any) => {
            const type = e.type || 'Unknown'
            acc[type] = (acc[type] || 0) + 1
            return acc
          }, {})

          console.log(chalk.cyan('\n📊 Summary by Type:'))
          Object.entries(byType).forEach(([type, count]) => {
            console.log(`  ${type}: ${chalk.yellow(count)}`)
          })
        }
      } else {
        formatOutput(entities, options)
      }
    } catch (error: any) {
      if (spinner) spinner.fail('Entity extraction failed')
      console.error(chalk.red('Extraction failed:', error.message))
      if (options.verbose) {
        console.error(chalk.dim(error.stack))
      }
      process.exit(1)
    }
  },

  /**
   * Extract concepts from text
   */
  async extractConcepts(text: string | undefined, options: NLPOptions & { threshold?: string }) {
    let spinner: any = null
    try {
      // Interactive mode if no text provided
      if (!text) {
        const answers = await inquirer.prompt([
          {
            type: 'editor',
            name: 'text',
            message: 'Enter or paste text to analyze:',
            validate: (input: string) => input.trim().length > 0 || 'Text cannot be empty'
          },
          {
            type: 'number',
            name: 'threshold',
            message: 'Minimum confidence threshold (0-1):',
            default: 0.5,
            validate: (input: number) => (input >= 0 && input <= 1) || 'Must be between 0 and 1'
          }
        ])

        text = answers.text
        if (!options.threshold) {
          options.threshold = answers.threshold.toString()
        }
      }

      spinner = ora('Extracting concepts with neural analysis...').start()
      const brain = getBrainy()

      const confidence = options.threshold ? parseFloat(options.threshold) : 0.5
      const concepts = await brain.extractConcepts(text, { confidence })

      spinner.succeed(`Extracted ${concepts.length} concepts`)

      if (!options.json) {
        if (concepts.length === 0) {
          console.log(chalk.yellow('\nNo concepts found above threshold'))
          console.log(chalk.dim(`Try lowering the threshold (currently ${confidence})`))
        } else {
          console.log(chalk.cyan(`\n💡 Extracted ${concepts.length} Concepts:\n`))

          // concepts is string[] - display as simple list
          concepts.forEach((concept, index) => {
            console.log(`  ${chalk.yellow(`${index + 1}.`)} ${concept}`)
          })

          console.log(chalk.dim(`\n💡 Confidence threshold: ${confidence} (${(confidence * 100).toFixed(0)}% minimum)`))
          console.log(chalk.dim(`    Higher threshold = fewer but more relevant concepts`))
        }
      } else {
        formatOutput(concepts, options)
      }
    } catch (error: any) {
      if (spinner) spinner.fail('Concept extraction failed')
      console.error(chalk.red('Extraction failed:', error.message))
      if (options.verbose) {
        console.error(chalk.dim(error.stack))
      }
      process.exit(1)
    }
  },

  /**
   * Analyze text with full NLP pipeline
   */
  async analyze(text: string | undefined, options: NLPOptions) {
    let spinner: any = null
    try {
      // Interactive mode if no text provided
      if (!text) {
        const answer = await inquirer.prompt([{
          type: 'editor',
          name: 'text',
          message: 'Enter or paste text to analyze:',
          validate: (input: string) => input.trim().length > 0 || 'Text cannot be empty'
        }])

        text = answer.text
      }

      spinner = ora('Analyzing text with neural NLP...').start()
      const brain = getBrainy()

      // Run both entity extraction and concept extraction
      const [entities, concepts] = await Promise.all([
        brain.extract(text),
        brain.extractConcepts(text, { confidence: 0.5 })
      ])

      spinner.succeed('Analysis complete')

      if (!options.json) {
        console.log(chalk.cyan('\n🧠 NLP Analysis Results:\n'))

        // Text summary
        const wordCount = text.split(/\s+/).length
        const charCount = text.length
        console.log(chalk.bold('📝 Text Summary:'))
        console.log(`  Characters: ${chalk.yellow(charCount)}`)
        console.log(`  Words: ${chalk.yellow(wordCount)}`)
        console.log(`  Avg word length: ${chalk.yellow((charCount / wordCount).toFixed(1))}`)

        // Entities
        console.log(chalk.bold('\n📌 Entities Detected:'), chalk.yellow(entities.length))
        if (entities.length > 0) {
          const table = new Table({
            head: [chalk.cyan('Entity'), chalk.cyan('Type'), chalk.cyan('Confidence')],
            colWidths: [40, 20, 15]
          })

          entities.slice(0, 10).forEach((e: any) => {
            table.push([
              e.content || e.text || 'Unknown',
              e.type || 'Unknown',
              `${((e.confidence || 0) * 100).toFixed(1)}%`
            ])
          })

          console.log(table.toString())

          if (entities.length > 10) {
            console.log(chalk.dim(`\n... and ${entities.length - 10} more entities`))
          }
        }

        // Concepts
        if (concepts.length > 0) {
          console.log(chalk.bold('\n💡 Key Concepts:'))
          concepts.slice(0, 10).forEach((concept, index) => {
            console.log(`  ${chalk.yellow(`${index + 1}.`)} ${concept}`)
          })
          if (concepts.length > 10) {
            console.log(chalk.dim(`  ... and ${concepts.length - 10} more`))
          }
        }

      } else {
        formatOutput({
          text: {
            length: text.length,
            wordCount: text.split(/\s+/).length
          },
          entities,
          concepts
        }, options)
      }
    } catch (error: any) {
      if (spinner) spinner.fail('Analysis failed')
      console.error(chalk.red('Analysis failed:', error.message))
      if (options.verbose) {
        console.error(chalk.dim(error.stack))
      }
      process.exit(1)
    }
  }
}
