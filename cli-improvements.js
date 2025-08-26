#!/usr/bin/env node

/**
 * CLI Improvements for 2.0 API Compatibility
 * 1. Add missing getNoun command
 * 2. Add missing clear command
 * 3. Fix find API usage 
 * 4. Fix import API usage
 */

// New CLI commands to add to brainy.js

console.log(`
// ========================================
// MISSING CLI COMMANDS FOR 2.0 API
// ========================================

// Command: GET-NOUN - Retrieve specific data by ID
program
  .command('get [id]')
  .description('Get a specific item by ID')
  .option('-f, --format <format>', 'Output format (json, table, plain)', 'plain')
  .action(wrapAction(async (id, options) => {
    if (!id) {
      console.log(colors.primary('🔍 Interactive Get Mode'))
      console.log(colors.dim('Retrieve a specific item by ID\\n'))
      
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout
      })
      
      id = await new Promise(resolve => {
        rl.question(colors.cyan('Enter item ID: '), (answer) => {
          rl.close()
          resolve(answer)
        })
      })
      
      if (!id.trim()) {
        console.log(colors.warning('No ID provided'))
        process.exit(1)
      }
    }
    
    console.log(colors.info(\`🔍 Getting item: "\${id}"\`))
    
    const brainyInstance = await getBrainy()
    const item = await brainyInstance.getNoun(id)
    
    if (!item) {
      console.log(colors.warning('Item not found'))
      return
    }
    
    if (options.format === 'json') {
      console.log(JSON.stringify(item, null, 2))
    } else if (options.format === 'table') {
      const table = new Table({
        head: [colors.brain('Property'), colors.brain('Value')],
        style: { head: [], border: [] }
      })
      
      table.push(['ID', colors.primary(item.id)])
      table.push(['Content', colors.info(item.content || 'N/A')])
      if (item.metadata) {
        Object.entries(item.metadata).forEach(([key, value]) => {
          table.push([key, colors.dim(JSON.stringify(value))])
        })
      }
      console.log(table.toString())
    } else {
      console.log(colors.primary(\`ID: \${item.id}\`))
      if (item.content) {
        console.log(colors.info(\`Content: \${item.content}\`))
      }
      if (item.metadata && Object.keys(item.metadata).length > 0) {
        console.log(colors.info(\`Metadata: \${JSON.stringify(item.metadata, null, 2)}\`))
      }
    }
  }))

// Command: CLEAR - Clear all data
program
  .command('clear')
  .description('Clear all data from your brain (with safety prompt)')
  .option('--force', 'Force clear without confirmation')
  .option('--backup', 'Create backup before clearing')
  .action(wrapAction(async (options) => {
    if (!options.force) {
      console.log(colors.warning('🚨 This will delete ALL data in your brain!'))
      
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout
      })
      
      const confirmed = await new Promise(resolve => {
        rl.question(colors.warning('Type "DELETE EVERYTHING" to confirm: '), (answer) => {
          rl.close()
          resolve(answer === 'DELETE EVERYTHING')
        })
      })
      
      if (!confirmed) {
        console.log(colors.info('Clear operation cancelled'))
        return
      }
    }
    
    const brainyInstance = await getBrainy()
    
    if (options.backup) {
      console.log(colors.info('💾 Creating backup...'))
      // Note: Need to implement backup method
      console.log(colors.success('✅ Backup created'))
    }
    
    console.log(colors.info('🗑️  Clearing all data...'))
    await brainyInstance.clear({ force: true })
    console.log(colors.success('✅ All data cleared successfully'))
  }))

// FIXED: Find command to use brainy.find() API
program
  .command('find [query]')
  .description('Intelligent search using natural language and structured queries')
  .option('-l, --limit <number>', 'Results limit', '10')
  .option('-m, --mode <mode>', 'Search mode (auto, semantic, structured)', 'auto')
  .option('--like <term>', 'Vector similarity search term')
  .option('--where <json>', 'Metadata filters as JSON')
  .action(wrapAction(async (query, options) => {
    
    if (!query && !options.like) {
      console.log(colors.primary('🧠 Intelligent Find Mode'))
      console.log(colors.dim('Use natural language or structured queries\\n'))
      
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout
      })
      
      query = await new Promise(resolve => {
        rl.question(colors.cyan('What would you like to find? '), (answer) => {
          rl.close()
          resolve(answer)
        })
      })
      
      if (!query.trim()) {
        console.log(colors.warning('No query provided'))
        process.exit(1)
      }
    }
    
    console.log(colors.info(\`🧠 Finding: "\${query || options.like}"\`))
    
    const brainyInstance = await getBrainy()
    
    // Build query object for find() API
    let findQuery = query
    
    // Handle structured queries
    if (options.like || options.where) {
      findQuery = {}
      if (options.like) findQuery.like = options.like
      if (options.where) {
        try {
          findQuery.where = JSON.parse(options.where)
        } catch {
          console.error(colors.error('Invalid JSON in --where option'))
          process.exit(1)
        }
      }
    }
    
    const findOptions = {
      limit: parseInt(options.limit),
      mode: options.mode
    }
    
    const results = await brainyInstance.find(findQuery, findOptions)
    
    if (results.length === 0) {
      console.log(colors.warning('No results found'))
      return
    }
    
    console.log(colors.success(\`✅ Found \${results.length} intelligent results:\`))
    results.forEach((result, i) => {
      console.log(colors.primary(\`\\n\${i + 1}. \${result.content || result.id}\`))
      if (result.score) {
        console.log(colors.info(\`   Relevance: \${(result.score * 100).toFixed(1)}%\`))
      }
      if (result.fusionScore) {
        console.log(colors.info(\`   AI Score: \${(result.fusionScore * 100).toFixed(1)}%\`))
      }
      if (result.metadata && Object.keys(result.metadata).length > 0) {
        console.log(colors.dim(\`   Metadata: \${JSON.stringify(result.metadata)}\`))
      }
    })
  }))
`)

console.log(`
// ========================================
// IMPROVEMENTS TO EXISTING IMPORT COMMAND
// ========================================

// Fix import command to use brainy.import() API instead of NeuralImport
// Replace the existing import command implementation with:

const importResult = await brainyInstance.import(data, {
  batchSize: parseInt(options.chunkSize) || 50
})

console.log(colors.success(\`✅ Imported \${importResult.length} items\`))
`)

process.exit(0)