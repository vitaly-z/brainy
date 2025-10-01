/**
 * Intelligent Import Example
 *
 * Demonstrates importing CSV, Excel, and PDF files with automatic:
 * - Format detection
 * - Type inference
 * - Entity extraction
 * - Relationship detection
 */

import { Brainy } from '../src/brainy.js'
import { promises as fs } from 'fs'
import * as path from 'path'

async function main() {
  console.log('🧠 Brainy Intelligent Import Example\n')

  const brain = new Brainy({ verbose: false })
  await brain.init()

  console.log('✅ Brainy initialized\n')

  // Example 1: Import CSV file
  console.log('📄 Example 1: Import CSV File')
  console.log('─────────────────────────────\n')

  const csvPath = path.join(process.cwd(), 'tests/fixtures/import/simple.csv')
  const csvExists = await fs.access(csvPath).then(() => true).catch(() => false)

  if (csvExists) {
    const csvBuffer = await fs.readFile(csvPath)

    const csvResult = await brain.import(csvBuffer, {
      filename: 'simple.csv',
      format: 'auto' // Auto-detects as CSV
    })

    console.log(`✨ Imported CSV with ${csvResult.length || 'structured'} data`)
    console.log('   Auto-detected: delimiter, encoding, types')
    console.log('   Extracted: entities with proper typing\n')
  }

  // Example 2: Import Excel file
  console.log('📊 Example 2: Import Excel Workbook')
  console.log('────────────────────────────────────\n')

  const excelPath = path.join(process.cwd(), 'tests/fixtures/import/multi-sheet.xlsx')
  const excelExists = await fs.access(excelPath).then(() => true).catch(() => false)

  if (excelExists) {
    const excelBuffer = await fs.readFile(excelPath)

    const excelResult = await brain.import(excelBuffer, {
      filename: 'multi-sheet.xlsx',
      format: 'auto', // Auto-detects as Excel
      excelSheets: 'all' // Process all sheets
    })

    console.log(`✨ Imported Excel workbook`)
    console.log('   Processed: Multiple sheets')
    console.log('   Extracted: Structured data from each sheet')
    console.log('   Preserved: Sheet metadata and relationships\n')
  }

  // Example 3: Import PDF file
  console.log('📑 Example 3: Import PDF Document')
  console.log('─────────────────────────────────\n')

  const pdfPath = path.join(process.cwd(), 'tests/fixtures/import/simple.pdf')
  const pdfExists = await fs.access(pdfPath).then(() => true).catch(() => false)

  if (pdfExists) {
    const pdfBuffer = await fs.readFile(pdfPath)

    const pdfResult = await brain.import(pdfBuffer, {
      filename: 'simple.pdf',
      format: 'auto', // Auto-detects as PDF
      pdfExtractTables: true
    })

    console.log(`✨ Imported PDF document`)
    console.log('   Extracted: Text content with layout preservation')
    console.log('   Detected: Tables (if present)')
    console.log('   Preserved: Metadata (author, title, dates)\n')
  }

  // Example 4: Import with specific sheet selection
  console.log('🎯 Example 4: Selective Sheet Import')
  console.log('────────────────────────────────────\n')

  if (excelExists) {
    const excelBuffer = await fs.readFile(excelPath)

    await brain.import(excelBuffer, {
      filename: 'multi-sheet.xlsx',
      excelSheets: ['Products'] // Only import Products sheet
    })

    console.log(`✨ Imported specific Excel sheet`)
    console.log('   Sheet: Products only')
    console.log('   Benefit: Faster processing, focused data\n')
  }

  // Example 5: CSV with custom delimiter
  console.log('⚙️  Example 5: CSV with Custom Delimiter')
  console.log('───────────────────────────────────────\n')

  const tsvPath = path.join(process.cwd(), 'tests/fixtures/import/tab-delimited.csv')
  const tsvExists = await fs.access(tsvPath).then(() => true).catch(() => false)

  if (tsvExists) {
    const tsvBuffer = await fs.readFile(tsvPath)

    await brain.import(tsvBuffer, {
      filename: 'tab-delimited.csv',
      format: 'csv',
      csvDelimiter: '\t' // Or let it auto-detect
    })

    console.log(`✨ Imported tab-delimited file`)
    console.log('   Delimiter: Auto-detected (tab)')
    console.log('   Works with: comma, semicolon, tab, pipe\n')
  }

  // Example 6: Query imported data
  console.log('🔍 Example 6: Query Imported Data')
  console.log('──────────────────────────────────\n')

  const results = await brain.search('product', { limit: 5 })
  console.log(`Found ${results.length} results for "product"`)

  if (results.length > 0) {
    console.log('Sample result:')
    const sample = results[0]
    console.log(`   ID: ${sample.id}`)
    console.log(`   Data: ${JSON.stringify(sample.data).slice(0, 100)}...`)
  }

  console.log('\n✨ Example Complete!')
  console.log('\n📚 Key Takeaways:')
  console.log('  • One method (brain.import) handles CSV, Excel, and PDF')
  console.log('  • Format auto-detection from file extension or content')
  console.log('  • Intelligent parsing: encoding, delimiters, types, tables')
  console.log('  • Zero config required - works out of the box')
  console.log('  • All data becomes searchable via Triple Intelligence')
}

main().catch(console.error)
