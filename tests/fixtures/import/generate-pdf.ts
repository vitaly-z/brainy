/**
 * Script to generate PDF test fixtures
 * Run with: npx tsx tests/fixtures/import/generate-pdf.ts
 */

import { jsPDF } from 'jspdf'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { writeFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Simple text PDF
function createSimpleTextPDF() {
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.text('Simple PDF Document', 20, 20)

  doc.setFontSize(12)
  doc.text('This is a test PDF with simple text content.', 20, 40)
  doc.text('It contains multiple paragraphs to test text extraction.', 20, 50)

  doc.text('Second paragraph starts here.', 20, 70)
  doc.text('This paragraph has multiple sentences. Each sentence adds more text.', 20, 80)

  doc.text('Third paragraph demonstrates extraction capabilities.', 20, 100)

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
  writeFileSync(path.join(__dirname, 'simple.pdf'), pdfBuffer)
  console.log('✅ Created simple.pdf')
}

// PDF with table-like structure
function createTablePDF() {
  const doc = new jsPDF()

  doc.setFontSize(14)
  doc.text('Employee Records', 20, 20)

  // Table headers
  doc.setFontSize(10)
  doc.setFont(undefined, 'bold')
  doc.text('Name', 20, 40)
  doc.text('Age', 80, 40)
  doc.text('Department', 120, 40)

  // Table rows
  doc.setFont(undefined, 'normal')
  doc.text('Alice Johnson', 20, 50)
  doc.text('28', 80, 50)
  doc.text('Engineering', 120, 50)

  doc.text('Bob Smith', 20, 60)
  doc.text('35', 80, 60)
  doc.text('Sales', 120, 60)

  doc.text('Charlie Brown', 20, 70)
  doc.text('42', 80, 70)
  doc.text('Engineering', 120, 70)

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
  writeFileSync(path.join(__dirname, 'table.pdf'), pdfBuffer)
  console.log('✅ Created table.pdf')
}

// Multi-page PDF
function createMultiPagePDF() {
  const doc = new jsPDF()

  // Page 1
  doc.setFontSize(16)
  doc.text('Page 1: Introduction', 20, 20)
  doc.setFontSize(12)
  doc.text('This is the first page of a multi-page PDF document.', 20, 40)
  doc.text('It demonstrates that the PDF handler can process multiple pages.', 20, 50)

  // Page 2
  doc.addPage()
  doc.setFontSize(16)
  doc.text('Page 2: Content', 20, 20)
  doc.setFontSize(12)
  doc.text('This is the second page with different content.', 20, 40)
  doc.text('Each page should be extracted separately.', 20, 50)

  // Page 3
  doc.addPage()
  doc.setFontSize(16)
  doc.text('Page 3: Conclusion', 20, 20)
  doc.setFontSize(12)
  doc.text('This is the final page of the document.', 20, 40)

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
  writeFileSync(path.join(__dirname, 'multi-page.pdf'), pdfBuffer)
  console.log('✅ Created multi-page.pdf')
}

// PDF with metadata
function createMetadataPDF() {
  const doc = new jsPDF()

  // Set metadata
  doc.setProperties({
    title: 'Test Document',
    subject: 'PDF Testing',
    author: 'Test Author',
    keywords: 'pdf, test, metadata',
    creator: 'Brainy Test Suite'
  })

  doc.setFontSize(14)
  doc.text('PDF with Metadata', 20, 20)
  doc.setFontSize(12)
  doc.text('This PDF has metadata that should be extracted.', 20, 40)

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
  writeFileSync(path.join(__dirname, 'metadata.pdf'), pdfBuffer)
  console.log('✅ Created metadata.pdf')
}

// Empty PDF (edge case)
function createEmptyPDF() {
  const doc = new jsPDF()

  // Just a blank page
  doc.text('', 20, 20)

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
  writeFileSync(path.join(__dirname, 'empty.pdf'), pdfBuffer)
  console.log('✅ Created empty.pdf')
}

// Generate all fixtures
async function main() {
  console.log('Generating PDF test fixtures...\n')

  createSimpleTextPDF()
  createTablePDF()
  createMultiPagePDF()
  createMetadataPDF()
  createEmptyPDF()

  console.log('\n✨ All PDF fixtures generated!')
}

main().catch(console.error)
