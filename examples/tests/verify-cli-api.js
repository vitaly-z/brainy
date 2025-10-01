#!/usr/bin/env node

/**
 * 🧠 Comprehensive CLI API Compatibility Verification
 * Verifies ALL public API methods are properly integrated in CLI
 */

import { Brainy } from '../../dist/index.js'
import fs from 'fs'

console.log('🧠 Brainy 2.0 - Comprehensive CLI API Verification')
console.log('=' + '='.repeat(55))

// Read CLI code
const cliCode = fs.readFileSync('./bin/brainy.js', 'utf8')

// Core API methods that CLI should support
const coreApiMethods = [
  'addNoun',
  'updateNoun', 
  'deleteNoun',
  'getNoun',
  'search',
  'find',
  'getStatistics',
  'clear',
  'export',
  'import',
  'addVerb'
]

// Optional/advanced methods
const advancedApiMethods = [
  'addNouns',  // batch operations
  'searchWithCursor', // pagination
  'searchByNounTypes' // filtered search
]

console.log('\n📋 Core API Method Coverage Analysis:')
console.log('=' + '='.repeat(40))

const results = {
  covered: [],
  missing: [],
  incorrectUsage: []
}

coreApiMethods.forEach(method => {
  const hasMethod = cliCode.includes(`${method}(`)
  const hasCorrectUsage = cliCode.includes(`brainy.${method}(`) || 
                         cliCode.includes(`brainyInstance.${method}(`) ||
                         cliCode.includes(`brain.${method}(`)
  
  if (hasMethod && hasCorrectUsage) {
    results.covered.push(method)
    console.log(`✅ ${method.padEnd(20)} - Properly integrated`)
  } else if (hasMethod && !hasCorrectUsage) {
    results.incorrectUsage.push(method)
    console.log(`⚠️  ${method.padEnd(20)} - Found but incorrect usage`)
  } else {
    results.missing.push(method)
    console.log(`❌ ${method.padEnd(20)} - Missing from CLI`)
  }
})

console.log('\n🔍 Advanced API Method Coverage:')
console.log('=' + '='.repeat(30))

advancedApiMethods.forEach(method => {
  const hasMethod = cliCode.includes(`${method}(`)
  if (hasMethod) {
    console.log(`✨ ${method.padEnd(20)} - Advanced feature available`)
  } else {
    console.log(`⚪ ${method.padEnd(20)} - Not implemented (optional)`)
  }
})

console.log('\n🎯 CLI Command Coverage Analysis:')
console.log('=' + '='.repeat(35))

const expectedCommands = {
  'add': 'addNoun',
  'search': 'search', 
  'update': 'updateNoun',
  'delete': 'deleteNoun',
  'status': 'getStatistics',
  'export': 'export',
  'import': 'import',
  'add-noun': 'addNoun',
  'add-verb': 'addVerb'
}

Object.entries(expectedCommands).forEach(([command, apiMethod]) => {
  const hasCommand = cliCode.includes(`program\n  .command('${command}`)
  const usesCorrectApi = cliCode.includes(`${apiMethod}(`)
  
  if (hasCommand && usesCorrectApi) {
    console.log(`✅ ${command.padEnd(15)} → ${apiMethod}`)
  } else if (hasCommand && !usesCorrectApi) {
    console.log(`⚠️  ${command.padEnd(15)} → Missing ${apiMethod} integration`)
  } else {
    console.log(`❌ ${command.padEnd(15)} → Command missing`)
  }
})

console.log('\n🔧 API Usage Pattern Analysis:')
console.log('=' + '='.repeat(32))

// Check for old vs new API patterns
const oldPatterns = [
  { pattern: /\.search\([^,]+,\s*\d+,/g, issue: 'Old 3-parameter search()' },
  { pattern: /\.add\(/g, issue: 'Old add() method instead of addNoun()' },
  { pattern: /\.update\(/g, issue: 'Old update() method instead of updateNoun()' },
  { pattern: /\.delete\(/g, issue: 'Old delete() method instead of deleteNoun()' }
]

let apiIssues = 0
oldPatterns.forEach(({ pattern, issue }) => {
  const matches = cliCode.match(pattern)
  if (matches) {
    apiIssues += matches.length
    console.log(`⚠️  Found ${matches.length}x: ${issue}`)
  }
})

if (apiIssues === 0) {
  console.log('✅ No API compatibility issues found!')
}

console.log('\n📊 Summary Report:')
console.log('=' + '='.repeat(18))
console.log(`Core Methods Covered: ${results.covered.length}/${coreApiMethods.length} (${((results.covered.length/coreApiMethods.length)*100).toFixed(1)}%)`)
console.log(`Missing Methods: ${results.missing.length}`)
console.log(`Incorrect Usage: ${results.incorrectUsage.length}`) 
console.log(`API Issues: ${apiIssues}`)

const overallScore = ((results.covered.length / coreApiMethods.length) * 100)
console.log(`\n🎯 Overall CLI API Compatibility: ${overallScore.toFixed(1)}%`)

if (overallScore >= 95) {
  console.log('🟢 EXCELLENT - CLI fully compatible with 2.0 API')
} else if (overallScore >= 85) {
  console.log('🟡 GOOD - Minor compatibility issues to address')
} else if (overallScore >= 70) {
  console.log('🟠 NEEDS WORK - Several compatibility issues')
} else {
  console.log('🔴 CRITICAL - Major compatibility issues')
}

// Specific recommendations
console.log('\n💡 Recommendations:')
if (results.missing.length > 0) {
  console.log(`📝 Add CLI commands for: ${results.missing.join(', ')}`)
}
if (results.incorrectUsage.length > 0) {
  console.log(`🔧 Fix API usage for: ${results.incorrectUsage.join(', ')}`)
}
if (apiIssues > 0) {
  console.log('🔄 Update to use new 2.0 API patterns')
}
if (overallScore === 100) {
  console.log('🎉 Perfect! CLI is 100% compatible with 2.0 API')
}

process.exit(0)