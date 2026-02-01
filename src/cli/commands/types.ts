/**
 * CLI Commands for Type Management
 */

import chalk from 'chalk'
import inquirer from 'inquirer'
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
      console.log(chalk.bold.cyan(`\nNoun Types (${BrainyTypes.nouns.length}):\n`))
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
      console.log(chalk.bold.cyan(`\nVerb Types (${BrainyTypes.verbs.length}):\n`))
      const verbChunks = []
      for (let i = 0; i < BrainyTypes.verbs.length; i += 3) {
        verbChunks.push(BrainyTypes.verbs.slice(i, i + 3))
      }

      for (const chunk of verbChunks) {
        console.log('  ' + chunk.map(v => chalk.blue(v.padEnd(20))).join(''))
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