/**
 * Script to generate Excel test fixtures
 * Run with: npx tsx tests/fixtures/import/generate-excel.ts
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Simple single-sheet workbook
function createSimpleWorkbook() {
  const data = [
    ['Name', 'Age', 'Department', 'Salary', 'Active'],
    ['Alice Johnson', 28, 'Engineering', 95000, true],
    ['Bob Smith', 35, 'Sales', 75000, true],
    ['Charlie Brown', 42, 'Engineering', 105000, false],
    ['Diana Prince', 31, 'Marketing', 85000, true]
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Employees')

  XLSX.writeFile(wb, path.join(__dirname, 'simple.xlsx'))
  console.log('✅ Created simple.xlsx')
}

// Multi-sheet workbook
function createMultiSheetWorkbook() {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Products
  const products = [
    ['ID', 'Product', 'Price', 'Stock', 'Category'],
    [1, 'Laptop', 999.99, 50, 'Electronics'],
    [2, 'Mouse', 29.99, 200, 'Electronics'],
    [3, 'Desk', 299.99, 30, 'Furniture'],
    [4, 'Chair', 199.99, 45, 'Furniture']
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(products)
  XLSX.utils.book_append_sheet(wb, ws1, 'Products')

  // Sheet 2: Orders
  const orders = [
    ['OrderID', 'ProductID', 'Quantity', 'Date', 'Status'],
    [1001, 1, 2, '2024-01-15', 'Shipped'],
    [1002, 2, 5, '2024-01-16', 'Delivered'],
    [1003, 3, 1, '2024-01-17', 'Processing']
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(orders)
  XLSX.utils.book_append_sheet(wb, ws2, 'Orders')

  // Sheet 3: Customers
  const customers = [
    ['CustomerID', 'Name', 'Email', 'Country'],
    [101, 'John Doe', 'john@example.com', 'USA'],
    [102, 'Jane Smith', 'jane@example.com', 'Canada'],
    [103, 'Bob Wilson', 'bob@example.com', 'UK']
  ]
  const ws3 = XLSX.utils.aoa_to_sheet(customers)
  XLSX.utils.book_append_sheet(wb, ws3, 'Customers')

  XLSX.writeFile(wb, path.join(__dirname, 'multi-sheet.xlsx'))
  console.log('✅ Created multi-sheet.xlsx')
}

// Workbook with types
function createTypesWorkbook() {
  const data = [
    ['ID', 'Name', 'Score', 'Percentage', 'Date', 'Active'],
    [1, 'Alice', 95.5, 0.955, new Date('2024-01-15'), true],
    [2, 'Bob', 87.3, 0.873, new Date('2024-02-20'), false],
    [3, 'Charlie', 92.8, 0.928, new Date('2024-03-10'), true]
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Scores')

  XLSX.writeFile(wb, path.join(__dirname, 'types.xlsx'))
  console.log('✅ Created types.xlsx')
}

// Empty workbook (edge case)
function createEmptyWorkbook() {
  const ws = XLSX.utils.aoa_to_sheet([['Header1', 'Header2', 'Header3']])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Empty')

  XLSX.writeFile(wb, path.join(__dirname, 'empty.xlsx'))
  console.log('✅ Created empty.xlsx')
}

// Generate all fixtures
async function main() {
  console.log('Generating Excel test fixtures...\n')

  createSimpleWorkbook()
  createMultiSheetWorkbook()
  createTypesWorkbook()
  createEmptyWorkbook()

  console.log('\n✨ All Excel fixtures generated!')
}

main().catch(console.error)
