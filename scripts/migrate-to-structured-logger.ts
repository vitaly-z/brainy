#!/usr/bin/env node

/**
 * Migration script to replace console.log statements with structured logger
 * Usage: npm run migrate:logger [--dry-run] [--file=path/to/file.ts]
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'
import { fileURLToPath } from 'url'

interface MigrationOptions {
  dryRun: boolean
  targetFile?: string
  verbose: boolean
}

interface MigrationResult {
  file: string
  changes: number
  errors: string[]
}

class LoggerMigrator {
  private results: MigrationResult[] = []
  
  constructor(private options: MigrationOptions) {}

  async migrate(): Promise<void> {
    console.log('🔄 Starting logger migration...')
    
    const files = await this.getFilesToMigrate()
    console.log(`Found ${files.length} TypeScript files to process`)
    
    for (const file of files) {
      await this.migrateFile(file)
    }
    
    this.printSummary()
  }

  private async getFilesToMigrate(): Promise<string[]> {
    if (this.options.targetFile) {
      return [this.options.targetFile]
    }
    
    // Get all TypeScript files excluding node_modules, dist, and test files
    const pattern = 'src/**/*.ts'
    const ignore = [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/logger.ts',
      '**/structuredLogger.ts'
    ]
    
    return glob(pattern, { ignore })
  }

  private async migrateFile(filePath: string): Promise<void> {
    const result: MigrationResult = {
      file: filePath,
      changes: 0,
      errors: []
    }
    
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const moduleName = this.extractModuleName(filePath)
      
      let modified = content
      let changesMade = false
      
      // Check if file already imports logger
      const hasLoggerImport = /import.*(?:createModuleLogger|structuredLogger).*from/.test(content)
      const hasConsoleUsage = /console\.(log|warn|error|info|debug)/.test(content)
      
      if (!hasConsoleUsage) {
        if (this.options.verbose) {
          console.log(`  ⏭️  ${filePath} - No console statements found`)
        }
        return
      }
      
      // Add import if needed
      if (!hasLoggerImport && hasConsoleUsage) {
        modified = this.addLoggerImport(modified)
        changesMade = true
      }
      
      // Replace console statements
      const patterns = [
        {
          // console.log with string literal
          pattern: /console\.log\s*\(\s*(['"`])([^'"`]*)\1\s*(?:,\s*(.+?))?\s*\)/g,
          replacement: (match: string, quote: string, message: string, args?: string) => {
            result.changes++
            return args 
              ? `logger.info('${message}', ${args})`
              : `logger.info('${message}')`
          }
        },
        {
          // console.error with string literal
          pattern: /console\.error\s*\(\s*(['"`])([^'"`]*)\1\s*(?:,\s*(.+?))?\s*\)/g,
          replacement: (match: string, quote: string, message: string, args?: string) => {
            result.changes++
            return args
              ? `logger.error('${message}', ${args})`
              : `logger.error('${message}')`
          }
        },
        {
          // console.warn with string literal
          pattern: /console\.warn\s*\(\s*(['"`])([^'"`]*)\1\s*(?:,\s*(.+?))?\s*\)/g,
          replacement: (match: string, quote: string, message: string, args?: string) => {
            result.changes++
            return args
              ? `logger.warn('${message}', ${args})`
              : `logger.warn('${message}')`
          }
        },
        {
          // console.info with string literal
          pattern: /console\.info\s*\(\s*(['"`])([^'"`]*)\1\s*(?:,\s*(.+?))?\s*\)/g,
          replacement: (match: string, quote: string, message: string, args?: string) => {
            result.changes++
            return args
              ? `logger.info('${message}', ${args})`
              : `logger.info('${message}')`
          }
        },
        {
          // console.debug with string literal
          pattern: /console\.debug\s*\(\s*(['"`])([^'"`]*)\1\s*(?:,\s*(.+?))?\s*\)/g,
          replacement: (match: string, quote: string, message: string, args?: string) => {
            result.changes++
            return args
              ? `logger.debug('${message}', ${args})`
              : `logger.debug('${message}')`
          }
        }
      ]
      
      // Apply replacements
      for (const { pattern, replacement } of patterns) {
        const before = modified
        modified = modified.replace(pattern, replacement as any)
        if (before !== modified) {
          changesMade = true
        }
      }
      
      // Handle complex console statements that need manual review
      const complexPatterns = [
        /console\.(log|warn|error|info|debug)\s*\([^'"`]/g
      ]
      
      for (const pattern of complexPatterns) {
        const matches = modified.match(pattern)
        if (matches) {
          for (const match of matches) {
            result.errors.push(`Complex console statement needs manual review: ${match.substring(0, 50)}...`)
            
            // Add a TODO comment for manual review
            modified = modified.replace(
              match,
              `// TODO: Migrate to structured logger\n    ${match}`
            )
          }
        }
      }
      
      // Add logger declaration after imports
      if (changesMade && !hasLoggerImport) {
        const importEndMatch = modified.match(/^((?:import.*\n)+)/m)
        if (importEndMatch) {
          const afterImports = importEndMatch.index! + importEndMatch[0].length
          modified = 
            modified.slice(0, afterImports) +
            `\nconst logger = createModuleLogger('${moduleName}')\n` +
            modified.slice(afterImports)
        }
      }
      
      // Write changes
      if (changesMade && !this.options.dryRun) {
        await fs.writeFile(filePath, modified, 'utf-8')
        console.log(`  ✅ ${filePath} - ${result.changes} changes`)
      } else if (changesMade) {
        console.log(`  🔍 ${filePath} - ${result.changes} changes (dry run)`)
      }
      
      this.results.push(result)
      
    } catch (error) {
      result.errors.push(`Failed to process file: ${error}`)
      this.results.push(result)
    }
  }
  
  private addLoggerImport(content: string): string {
    // Find the last import statement
    const importMatches = [...content.matchAll(/^import.*$/gm)]
    
    if (importMatches.length > 0) {
      const lastImport = importMatches[importMatches.length - 1]
      const insertPos = lastImport.index! + lastImport[0].length
      
      const relativeImportPath = this.getRelativeImportPath()
      const importStatement = `\nimport { createModuleLogger } from '${relativeImportPath}'`
      
      return content.slice(0, insertPos) + importStatement + content.slice(insertPos)
    }
    
    // No imports found, add at the beginning
    const relativeImportPath = this.getRelativeImportPath()
    return `import { createModuleLogger } from '${relativeImportPath}'\n\n${content}`
  }
  
  private getRelativeImportPath(): string {
    // This will be calculated based on the file being processed
    // For now, return a placeholder
    return '../utils/structuredLogger.js'
  }
  
  private extractModuleName(filePath: string): string {
    // Extract module name from file path
    const relativePath = path.relative('src', filePath)
    const moduleName = relativePath
      .replace(/\.ts$/, '')
      .replace(/\//g, ':')
      .replace(/\\+/g, ':')
    
    return moduleName
  }
  
  private printSummary(): void {
    console.log('\n📊 Migration Summary:')
    console.log('=' .repeat(50))
    
    let totalChanges = 0
    let totalErrors = 0
    let filesWithChanges = 0
    let filesWithErrors = 0
    
    for (const result of this.results) {
      if (result.changes > 0) {
        filesWithChanges++
        totalChanges += result.changes
      }
      if (result.errors.length > 0) {
        filesWithErrors++
        totalErrors += result.errors.length
        
        console.log(`\n⚠️  ${result.file}:`)
        for (const error of result.errors) {
          console.log(`   - ${error}`)
        }
      }
    }
    
    console.log('\n📈 Statistics:')
    console.log(`  Files processed: ${this.results.length}`)
    console.log(`  Files modified: ${filesWithChanges}`)
    console.log(`  Total changes: ${totalChanges}`)
    console.log(`  Files with errors: ${filesWithErrors}`)
    console.log(`  Total errors: ${totalErrors}`)
    
    if (this.options.dryRun) {
      console.log('\n⚠️  This was a dry run. No files were modified.')
      console.log('Run without --dry-run to apply changes.')
    }
    
    if (totalErrors > 0) {
      console.log('\n⚠️  Some console statements need manual review.')
      console.log('Search for "TODO: Migrate to structured logger" in the code.')
    }
  }
}

// Parse command line arguments
function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2)
  const options: MigrationOptions = {
    dryRun: false,
    verbose: false
  }
  
  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true
    } else if (arg.startsWith('--file=')) {
      options.targetFile = arg.split('=')[1]
    }
  }
  
  return options
}

// Main execution
async function main() {
  const options = parseArgs()
  const migrator = new LoggerMigrator(options)
  
  try {
    await migrator.migrate()
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { LoggerMigrator, MigrationOptions }