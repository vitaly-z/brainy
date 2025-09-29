/**
 * 🧠 Neural Similarity API Commands
 * 
 * CLI interface for semantic similarity, clustering, and neural operations
 */

import inquirer from 'inquirer'
import chalk from 'chalk'
import ora from 'ora'
import fs from 'node:fs'
import path from 'node:path'
import { Brainy } from '../../brainy.js'

interface CommandArguments {
  action?: string;
  id?: string;
  query?: string;
  threshold?: number;
  format?: string;
  output?: string;
  limit?: number;
  algorithm?: string;
  dimensions?: number;
  explain?: boolean;
  _: string[];
}

export const neuralCommand = {
  command: 'neural [action]',
  describe: '🧠 Neural similarity and clustering operations',
  
  builder: (yargs: any) => {
    return yargs
      .positional('action', {
        describe: 'Neural operation to perform',
        type: 'string',
        choices: ['similar', 'clusters', 'hierarchy', 'neighbors', 'path', 'outliers', 'visualize']
      })
      .option('id', {
        describe: 'Item ID for similarity operations',
        type: 'string',
        alias: 'i'
      })
      .option('query', {
        describe: 'Query text for similarity search',
        type: 'string',
        alias: 'q'
      })
      .option('threshold', {
        describe: 'Similarity threshold (0-1)',
        type: 'number',
        default: 0.7,
        alias: 't'
      })
      .option('format', {
        describe: 'Output format',
        type: 'string',
        choices: ['json', 'table', 'tree', 'graph'],
        default: 'table',
        alias: 'f'
      })
      .option('output', {
        describe: 'Output file path',
        type: 'string',
        alias: 'o'
      })
      .option('limit', {
        describe: 'Maximum number of results',
        type: 'number',
        default: 10,
        alias: 'l'
      })
      .option('algorithm', {
        describe: 'Clustering algorithm',
        type: 'string',
        choices: ['hierarchical', 'kmeans', 'dbscan', 'auto'],
        default: 'auto',
        alias: 'a'
      })
      .option('dimensions', {
        describe: 'Visualization dimensions (2 or 3)',
        type: 'number',
        choices: [2, 3],
        default: 2,
        alias: 'd'
      })
      .option('explain', {
        describe: 'Include detailed explanations',
        type: 'boolean',
        default: false,
        alias: 'e'
      })
  },
  
  handler: async (argv: CommandArguments) => {
    console.log(chalk.cyan('\n🧠 NEURAL SIMILARITY API'))
    console.log(chalk.gray('━'.repeat(50)))

    // Initialize Brainy and Neural API
    const brain = new Brainy()
    const neural = brain.neural()
    
    try {
      const action = argv.action || await promptForAction()
      
      switch (action) {
        case 'similar':
          await handleSimilarCommand(neural, argv)
          break
        case 'clusters':
          await handleClustersCommand(neural, argv)
          break
        case 'hierarchy':
          await handleHierarchyCommand(neural, argv)
          break
        case 'neighbors':
          await handleNeighborsCommand(neural, argv)
          break
        case 'path':
          console.log(chalk.yellow('\n⚠️  Semantic path finding coming in v3.21.0'))
          console.log(chalk.dim('This feature requires implementing graph traversal algorithms'))
          console.log(chalk.dim('Use "neighbors" and "hierarchy" commands to explore connections'))
          break
        case 'outliers':
          await handleOutliersCommand(neural, argv)
          break
        case 'visualize':
          await handleVisualizeCommand(neural, argv)
          break
        default:
          console.log(chalk.red(`❌ Unknown action: ${action}`))
          showHelp()
      }
    } catch (error) {
      console.error(chalk.red('💥 Error:'), error instanceof Error ? error.message : error)
      process.exit(1)
    }
  }
}

async function promptForAction(): Promise<string> {
  const answer = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'Choose a neural operation:',
    choices: [
      { name: '🔗 Calculate similarity between items', value: 'similar' },
      { name: '🎯 Find semantic clusters', value: 'clusters' },
      { name: '🌳 Show item hierarchy', value: 'hierarchy' },
      { name: '🕸️  Find semantic neighbors', value: 'neighbors' },
      { name: '🛣️  Find semantic path between items (v3.21.0)', value: 'path', disabled: true },
      { name: '🚨 Detect outliers', value: 'outliers' },
      { name: '📊 Generate visualization data', value: 'visualize' }
    ]
  }])
  
  return answer.action
}

async function handleSimilarCommand(neural: any, argv: CommandArguments): Promise<void> {
  const spinner = ora('🧠 Calculating semantic similarity...').start()
  
  try {
    let itemA: string, itemB: string
    
    if (argv.id && argv.query) {
      itemA = argv.id
      itemB = argv.query
    } else if (argv._ && argv._.length >= 3) {
      itemA = argv._[1]
      itemB = argv._[2]
    } else {
      spinner.stop()
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'itemA',
          message: 'First item (ID or text):',
          validate: (input: string) => input.length > 0
        },
        {
          type: 'input',
          name: 'itemB',
          message: 'Second item (ID or text):',
          validate: (input: string) => input.length > 0
        }
      ])
      itemA = answers.itemA
      itemB = answers.itemB
      spinner.start()
    }
    
    const result = await neural.similar(itemA, itemB, {
      explain: argv.explain,
      includeBreakdown: argv.explain
    })
    
    spinner.succeed('✅ Similarity calculated')
    
    if (typeof result === 'number') {
      console.log(`\n🔗 Similarity: ${chalk.cyan((result * 100).toFixed(1))}%`)
    } else {
      console.log(`\n🔗 Similarity: ${chalk.cyan((result.score * 100).toFixed(1))}%`)
      if (result.explanation) {
        console.log(`💭 Explanation: ${result.explanation}`)
      }
      if (result.breakdown) {
        console.log('\n📊 Breakdown:')
        console.log(`  Semantic: ${chalk.yellow((result.breakdown.semantic! * 100).toFixed(1))}%`)
        if (result.breakdown.taxonomic !== undefined) {
          console.log(`  Taxonomic: ${chalk.yellow((result.breakdown.taxonomic * 100).toFixed(1))}%`)
        }
        if (result.breakdown.contextual !== undefined) {
          console.log(`  Contextual: ${chalk.yellow((result.breakdown.contextual * 100).toFixed(1))}%`)
        }
      }
      if (result.hierarchy) {
        console.log(`\n🌳 Hierarchy: ${result.hierarchy.sharedParent ? 
          `Shared parent at distance ${result.hierarchy.distance}` : 
          'No shared parent found'}`)
      }
    }
    
    if (argv.output) {
      await saveToFile(argv.output, result, argv.format!)
    }
    
  } catch (error) {
    spinner.fail('💥 Failed to calculate similarity')
    throw error
  }
}

async function handleClustersCommand(neural: any, argv: CommandArguments): Promise<void> {
  const spinner = ora('🎯 Finding semantic clusters...').start()
  
  try {
    const options = {
      algorithm: argv.algorithm as any,
      threshold: argv.threshold,
      maxClusters: argv.limit
    }
    
    const clusters = await neural.clusters(argv.query || options)
    
    spinner.succeed(`✅ Found ${clusters.length} clusters`)
    
    if (argv.format === 'json') {
      console.log(JSON.stringify(clusters, null, 2))
    } else {
      console.log(`\n🎯 ${chalk.cyan(clusters.length)} Semantic Clusters:\n`)
      
      clusters.forEach((cluster, index) => {
        console.log(`${chalk.yellow(`Cluster ${index + 1}:`)} ${cluster.label || cluster.id}`)
        console.log(`  📊 Confidence: ${chalk.green((cluster.confidence * 100).toFixed(1))}%`)
        console.log(`  👥 Members: ${cluster.members.length}`)
        if (cluster.members.length <= 5) {
          cluster.members.forEach(member => {
            console.log(`    • ${member}`)
          })
        } else {
          cluster.members.slice(0, 3).forEach(member => {
            console.log(`    • ${member}`)
          })
          console.log(`    ... and ${cluster.members.length - 3} more`)
        }
        console.log()
      })
    }
    
    if (argv.output) {
      await saveToFile(argv.output, clusters, argv.format!)
    }
    
  } catch (error) {
    spinner.fail('💥 Failed to find clusters')
    throw error
  }
}

async function handleHierarchyCommand(neural: any, argv: CommandArguments): Promise<void> {
  const spinner = ora('🌳 Building semantic hierarchy...').start()
  
  try {
    const id = argv.id || argv._[1]
    if (!id) {
      spinner.stop()
      const answer = await inquirer.prompt([{
        type: 'input',
        name: 'id',
        message: 'Enter item ID:',
        validate: (input: string) => input.length > 0
      }])
      spinner.start()
      const hierarchy = await neural.hierarchy(answer.id)
      displayHierarchy(hierarchy)
    } else {
      const hierarchy = await neural.hierarchy(id)
      spinner.succeed('✅ Hierarchy built')
      displayHierarchy(hierarchy)
    }
    
    if (argv.output) {
      const hierarchy = await neural.hierarchy(id || argv._[1])
      await saveToFile(argv.output, hierarchy, argv.format!)
    }
    
  } catch (error) {
    spinner.fail('💥 Failed to build hierarchy')
    throw error
  }
}

function displayHierarchy(hierarchy: any): void {
  console.log(`\n🌳 Semantic Hierarchy for ${chalk.cyan(hierarchy.self.id)}:`)
  
  if (hierarchy.root) {
    console.log(`🔝 Root: ${hierarchy.root.id} (${(hierarchy.root.similarity * 100).toFixed(1)}%)`)
  }
  
  if (hierarchy.grandparent) {
    console.log(`👴 Grandparent: ${hierarchy.grandparent.id} (${(hierarchy.grandparent.similarity * 100).toFixed(1)}%)`)
  }
  
  if (hierarchy.parent) {
    console.log(`👨 Parent: ${hierarchy.parent.id} (${(hierarchy.parent.similarity * 100).toFixed(1)}%)`)
  }
  
  console.log(`🎯 ${chalk.bold('Self:')} ${hierarchy.self.id}`)
  
  if (hierarchy.siblings && hierarchy.siblings.length > 0) {
    console.log(`👥 Siblings: ${hierarchy.siblings.length}`)
    hierarchy.siblings.forEach((sibling: any) => {
      console.log(`  • ${sibling.id} (${(sibling.similarity * 100).toFixed(1)}%)`)
    })
  }
  
  if (hierarchy.children && hierarchy.children.length > 0) {
    console.log(`👶 Children: ${hierarchy.children.length}`)
    hierarchy.children.forEach((child: any) => {
      console.log(`  • ${child.id} (${(child.similarity * 100).toFixed(1)}%)`)
    })
  }
}

async function handleNeighborsCommand(neural: any, argv: CommandArguments): Promise<void> {
  const spinner = ora('🕸️ Finding semantic neighbors...').start()
  
  try {
    const id = argv.id || argv._[1]
    if (!id) {
      spinner.stop()
      const answer = await inquirer.prompt([{
        type: 'input',
        name: 'id',
        message: 'Enter item ID:',
        validate: (input: string) => input.length > 0
      }])
      spinner.start()
    }
    
    const targetId = id || (await inquirer.prompt([{
      type: 'input',
      name: 'id',
      message: 'Enter item ID:',
      validate: (input: string) => input.length > 0
    }])).id
    
    const graph = await neural.neighbors(targetId, {
      limit: argv.limit,
      includeEdges: true
    })
    
    spinner.succeed(`✅ Found ${graph.neighbors.length} neighbors`)
    
    console.log(`\n🕸️ Neighbors of ${chalk.cyan(graph.center)}:`)
    
    graph.neighbors.forEach((neighbor, index) => {
      console.log(`${index + 1}. ${neighbor.id} (${(neighbor.similarity * 100).toFixed(1)}%)`)
      if (neighbor.type) {
        console.log(`   Type: ${neighbor.type}`)
      }
      if (neighbor.connections) {
        console.log(`   Connections: ${neighbor.connections}`)
      }
    })
    
    if (graph.edges && graph.edges.length > 0) {
      console.log(`\n🔗 ${graph.edges.length} semantic connections found`)
    }
    
    if (argv.output) {
      await saveToFile(argv.output, graph, argv.format!)
    }
    
  } catch (error) {
    spinner.fail('💥 Failed to find neighbors')
    throw error
  }
}

async function handlePathCommand(neural: any, argv: CommandArguments): Promise<void> {
  const spinner = ora('🛣️ Finding semantic path...').start()
  
  try {
    let fromId: string, toId: string
    
    if (argv._ && argv._.length >= 3) {
      fromId = argv._[1]
      toId = argv._[2]
    } else {
      spinner.stop()
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'from',
          message: 'From item ID:',
          validate: (input: string) => input.length > 0
        },
        {
          type: 'input',
          name: 'to',
          message: 'To item ID:',
          validate: (input: string) => input.length > 0
        }
      ])
      fromId = answers.from
      toId = answers.to
      spinner.start()
    }
    
    const path = await neural.semanticPath(fromId, toId)
    
    if (path.length === 0) {
      spinner.warn('🚫 No semantic path found')
      console.log(`No path found between ${chalk.cyan(fromId)} and ${chalk.cyan(toId)}`)
    } else {
      spinner.succeed(`✅ Found path with ${path.length} hops`)
      
      console.log(`\n🛣️ Semantic Path from ${chalk.cyan(fromId)} to ${chalk.cyan(toId)}:`)
      console.log(`${chalk.cyan(fromId)} (start)`)
      
      path.forEach((hop, index) => {
        console.log(`${'  '.repeat(index + 1)}↓ ${(hop.similarity * 100).toFixed(1)}%`)
        console.log(`${'  '.repeat(index + 1)}${hop.id} (hop ${hop.hop})`)
      })
    }
    
    if (argv.output) {
      await saveToFile(argv.output, path, argv.format!)
    }
    
  } catch (error) {
    spinner.fail('💥 Failed to find path')
    throw error
  }
}

async function handleOutliersCommand(neural: any, argv: CommandArguments): Promise<void> {
  const spinner = ora('🚨 Detecting semantic outliers...').start()
  
  try {
    const outliers = await neural.outliers(argv.threshold)
    
    spinner.succeed(`✅ Found ${outliers.length} outliers`)
    
    if (outliers.length === 0) {
      console.log('\n🎉 No outliers detected - all items are well connected!')
    } else {
      console.log(`\n🚨 ${chalk.red(outliers.length)} Semantic Outliers:`)
      outliers.forEach((outlier, index) => {
        console.log(`${index + 1}. ${outlier}`)
      })
      
      console.log(`\n💡 These items have similarity < ${argv.threshold} to their nearest neighbors`)
    }
    
    if (argv.output) {
      await saveToFile(argv.output, outliers, argv.format!)
    }
    
  } catch (error) {
    spinner.fail('💥 Failed to detect outliers')
    throw error
  }
}

async function handleVisualizeCommand(neural: any, argv: CommandArguments): Promise<void> {
  const spinner = ora('📊 Generating visualization data...').start()
  
  try {
    const vizData = await neural.visualize({
      dimensions: argv.dimensions as 2 | 3,
      maxNodes: argv.limit
    })
    
    spinner.succeed('✅ Visualization data generated')
    
    console.log(`\n📊 Visualization Data (${vizData.format} layout):`)
    console.log(`📍 Nodes: ${vizData.nodes.length}`)
    console.log(`🔗 Edges: ${vizData.edges.length}`)
    console.log(`🎯 Clusters: ${vizData.clusters?.length || 0}`)
    console.log(`📐 Dimensions: ${vizData.layout?.dimensions}D`)
    
    if (argv.format === 'json') {
      console.log('\nData:')
      console.log(JSON.stringify(vizData, null, 2))
    } else {
      console.log('\n🎨 Style Settings:')
      console.log(`  Node Colors: ${vizData.style?.nodeColors}`)
      console.log(`  Edge Width: ${vizData.style?.edgeWidth}`)
      console.log(`  Labels: ${vizData.style?.labels}`)
    }
    
    if (argv.output) {
      await saveToFile(argv.output, vizData, 'json')
      console.log(`\n💾 Visualization data saved to: ${chalk.green(argv.output)}`)
    } else {
      console.log(`\n💡 Use --output to save visualization data for external tools`)
    }
    
  } catch (error) {
    spinner.fail('💥 Failed to generate visualization')
    throw error
  }
}

async function saveToFile(filepath: string, data: any, format: string): Promise<void> {
  const dir = path.dirname(filepath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  
  let output: string
  switch (format) {
    case 'json':
      output = JSON.stringify(data, null, 2)
      break
    case 'table':
      output = formatAsTable(data)
      break
    default:
      output = JSON.stringify(data, null, 2)
  }
  
  fs.writeFileSync(filepath, output, 'utf8')
  console.log(`💾 Saved to: ${chalk.green(filepath)}`)
}

function formatAsTable(data: any): string {
  // Simple table formatting - could be enhanced with a table library
  if (Array.isArray(data)) {
    return data.map((item, index) => `${index + 1}. ${JSON.stringify(item)}`).join('\n')
  }
  return JSON.stringify(data, null, 2)
}

function showHelp(): void {
  console.log('\n🧠 Neural Similarity API Commands:')
  console.log('')
  console.log('  brainy neural similar <item1> <item2>    Calculate similarity')
  console.log('  brainy neural clusters                    Find semantic clusters')
  console.log('  brainy neural hierarchy <id>              Show item hierarchy')
  console.log('  brainy neural neighbors <id>              Find semantic neighbors')
  console.log('  brainy neural path <from> <to>            Find semantic path')
  console.log('  brainy neural outliers                    Detect outliers')
  console.log('  brainy neural visualize                   Generate visualization data')
  console.log('')
  console.log('Options:')
  console.log('  --threshold, -t   Similarity threshold (0-1)')
  console.log('  --format, -f      Output format (json|table|tree|graph)')
  console.log('  --output, -o      Save to file')
  console.log('  --limit, -l       Maximum results')
  console.log('  --explain, -e     Include explanations')
  console.log('')
}

export const neuralCommands = {
  similar: handleSimilarCommand,
  cluster: handleClustersCommand,
  hierarchy: handleHierarchyCommand,
  related: handleNeighborsCommand,
  // path: handlePathCommand, // Coming in v3.21.0 - requires graph traversal implementation
  outliers: handleOutliersCommand,
  visualize: handleVisualizeCommand
}

export default neuralCommand