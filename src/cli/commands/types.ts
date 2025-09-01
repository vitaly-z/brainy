/**
 * CLI Commands for Type Management
 * Consistent with BrainyTypes public API
 */

import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import Table from 'cli-table3'
import { BrainyTypes, NounType, VerbType } from '../../index.js'

/**
 * List types - matches BrainyTypes.nouns and BrainyTypes.verbs
 * Usage: brainy types
 */
export async function types(options: { json?: boolean, noun?: boolean, verb?: boolean }) {
  try {
    // Default to showing both if neither flag specified
    const showNouns = options.noun || (!options.noun && !options.verb)
    const showVerbs = options.verb || (!options.noun && !options.verb)
    
    const result: any = {}
    if (showNouns) result.nouns = BrainyTypes.nouns
    if (showVerbs) result.verbs = BrainyTypes.verbs

    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }

    // Display nouns
    if (showNouns) {
      console.log(chalk.bold.cyan('\n📚 Noun Types (31):\n'))
      const nounChunks = []
      for (let i = 0; i < BrainyTypes.nouns.length; i += 3) {
        nounChunks.push(BrainyTypes.nouns.slice(i, i + 3))
      }
      
      for (const chunk of nounChunks) {
        console.log('  ' + chunk.map(n => chalk.green(n.padEnd(20))).join(''))
      }
    }

    // Display verbs
    if (showVerbs) {
      console.log(chalk.bold.cyan('\n🔗 Verb Types (40):\n'))
      const verbChunks = []
      for (let i = 0; i < BrainyTypes.verbs.length; i += 3) {
        verbChunks.push(BrainyTypes.verbs.slice(i, i + 3))
      }
      
      for (const chunk of verbChunks) {
        console.log('  ' + chunk.map(v => chalk.blue(v.padEnd(20))).join(''))
      }
    }

    console.log(chalk.dim('\n💡 Use "brainy suggest <data>" to get AI-powered type suggestions'))

  } catch (error: any) {
    console.error(chalk.red('Error:', error.message))
    process.exit(1)
  }
}

/**
 * Suggest type - matches BrainyTypes.suggestNoun() and suggestVerb()
 * Usage: brainy suggest <data>
 * Interactive if data not provided
 */
export async function suggest(
  data?: string, 
  options: { 
    verb?: boolean,
    json?: boolean 
  } = {}
) {
  try {
    // Interactive mode if no data provided
    if (!data) {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'kind',
          message: 'What type do you want to suggest?',
          choices: ['Noun', 'Verb'],
          default: 'Noun'
        },
        {
          type: 'input',
          name: 'data',
          message: 'Enter data (JSON or text):',
          validate: (input) => input.length > 0 || 'Data is required'
        },
        {
          type: 'input',
          name: 'hint',
          message: 'Relationship hint (optional):',
          when: (answers) => answers.kind === 'Verb'
        }
      ])
      
      data = answers.data
      options.verb = answers.kind === 'Verb'
      
      // For verbs, parse source/target if provided as JSON
      if (options.verb && answers.hint) {
        data = JSON.stringify({ hint: answers.hint })
      }
    }

    const spinner = ora('Analyzing with AI...').start()
    
    let parsedData: any
    try {
      parsedData = JSON.parse(data)
    } catch {
      parsedData = { content: data }
    }

    let suggestion
    if (options.verb) {
      // For verb suggestions, need source and target
      const source = parsedData.source || { type: 'unknown' }
      const target = parsedData.target || { type: 'unknown' }
      const hint = parsedData.hint || parsedData.relationship || parsedData.verb
      
      suggestion = await BrainyTypes.suggestVerb(source, target, hint)
      spinner.succeed('Verb type analyzed')
    } else {
      suggestion = await BrainyTypes.suggestNoun(parsedData)
      spinner.succeed('Noun type analyzed')
    }

    if (options.json) {
      console.log(JSON.stringify(suggestion, null, 2))
      return
    }

    // Display results
    console.log(chalk.bold.green(`\n✨ Suggested: ${suggestion.type}`))
    console.log(chalk.cyan(`Confidence: ${(suggestion.confidence * 100).toFixed(1)}%`))
    
    if (suggestion.alternatives && suggestion.alternatives.length > 0) {
      console.log(chalk.yellow('\nAlternatives:'))
      for (const alt of suggestion.alternatives.slice(0, 3)) {
        console.log(`  ${alt.type} (${(alt.confidence * 100).toFixed(1)}%)`)
      }
    }

  } catch (error: any) {
    console.error(chalk.red('Error:', error.message))
    process.exit(1)
  }
}

/**
 * Validate type - matches BrainyTypes.isValidNoun() and isValidVerb()
 * Usage: brainy validate <type>
 */
export async function validate(
  type?: string,
  options: { verb?: boolean, json?: boolean } = {}
) {
  try {
    // Interactive mode if no type provided
    if (!type) {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'kind',
          message: 'Validate as:',
          choices: ['Noun Type', 'Verb Type'],
          default: 'Noun Type'
        },
        {
          type: 'input',
          name: 'type',
          message: 'Enter type to validate:',
          validate: (input) => input.length > 0 || 'Type is required'
        }
      ])
      
      type = answers.type
      options.verb = answers.kind === 'Verb Type'
    }

    const isValid = options.verb 
      ? BrainyTypes.isValidVerb(type)
      : BrainyTypes.isValidNoun(type)

    if (options.json) {
      console.log(JSON.stringify({ 
        type, 
        kind: options.verb ? 'verb' : 'noun',
        valid: isValid 
      }, null, 2))
      return
    }

    if (isValid) {
      console.log(chalk.green(`✅ "${type}" is valid`))
    } else {
      console.log(chalk.red(`❌ "${type}" is invalid`))
      
      // Show valid options
      const validTypes = options.verb ? BrainyTypes.verbs : BrainyTypes.nouns
      const similar = validTypes.filter(t => 
        t.toLowerCase().includes(type.toLowerCase()) ||
        type.toLowerCase().includes(t.toLowerCase())
      ).slice(0, 5)
      
      if (similar.length > 0) {
        console.log(chalk.yellow('\nDid you mean:'))
        similar.forEach(s => console.log(`  ${s}`))
      } else {
        console.log(chalk.dim(`\nRun "brainy types" to see all valid types`))
      }
    }
    
    process.exit(isValid ? 0 : 1)
    
  } catch (error: any) {
    console.error(chalk.red('Error:', error.message))
    process.exit(1)
  }
}