/**
 * Excel Format Handler
 * Handles Excel files (.xlsx, .xls, .xlsb) with:
 * - Multi-sheet extraction
 * - Type inference
 * - Formula evaluation
 * - Metadata extraction
 */

import * as XLSX from 'xlsx'
import { BaseFormatHandler } from './base.js'
import { FormatHandlerOptions, ProcessedData } from '../types.js'

export class ExcelHandler extends BaseFormatHandler {
  readonly format = 'excel'

  canHandle(data: Buffer | string | { filename?: string, ext?: string }): boolean {
    const ext = this.detectExtension(data)
    return ['xlsx', 'xls', 'xlsb', 'xlsm', 'xlt', 'xltx', 'xltm'].includes(ext || '')
  }

  async process(data: Buffer | string, options: FormatHandlerOptions): Promise<ProcessedData> {
    const startTime = Date.now()

    // Convert to buffer if string (though Excel should always be binary)
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'binary')

    try {
      // Read workbook
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellDates: true,
        cellNF: true,
        cellStyles: true
      })

      // Determine which sheets to process
      const sheetsToProcess = this.getSheetsToProcess(workbook, options)

      // Extract data from sheets
      const allData: Array<Record<string, any>> = []
      const sheetMetadata: Record<string, any> = {}

      for (const sheetName of sheetsToProcess) {
        const sheet = workbook.Sheets[sheetName]
        if (!sheet) continue

        // Convert sheet to JSON with headers
        const sheetData = XLSX.utils.sheet_to_json(sheet, {
          header: 1, // Get as array of arrays first
          defval: null,
          blankrows: false,
          raw: false // Convert to formatted strings
        }) as any[][]

        if (sheetData.length === 0) continue

        // First row is headers
        const headers = sheetData[0].map((h: any) =>
          this.sanitizeFieldName(String(h || ''))
        )

        // Skip if no headers
        if (headers.length === 0) continue

        // Convert rows to objects
        for (let i = 1; i < sheetData.length; i++) {
          const row = sheetData[i]
          const rowObj: Record<string, any> = {}

          // Add sheet name to each row
          rowObj._sheet = sheetName

          for (let j = 0; j < headers.length; j++) {
            const header = headers[j]
            let value = row[j]

            // Convert Excel dates
            if (value && typeof value === 'number' && this.isExcelDate(value)) {
              value = this.excelDateToJSDate(value)
            }

            rowObj[header] = value === undefined ? null : value
          }

          allData.push(rowObj)
        }

        // Store sheet metadata
        sheetMetadata[sheetName] = {
          rowCount: sheetData.length - 1, // Exclude header row
          columnCount: headers.length,
          headers
        }
      }

      // Infer types (excluding _sheet field)
      const fields = allData.length > 0 ? Object.keys(allData[0]).filter(k => k !== '_sheet') : []
      const types = this.inferFieldTypes(allData)

      // Convert values to appropriate types
      const convertedData = allData.map(row => {
        const converted: Record<string, any> = {}
        for (const [key, value] of Object.entries(row)) {
          if (key === '_sheet') {
            converted[key] = value
          } else {
            converted[key] = this.convertValue(value, types[key] || 'string')
          }
        }
        return converted
      })

      const processingTime = Date.now() - startTime

      return {
        format: this.format,
        data: convertedData,
        metadata: this.createMetadata(
          convertedData.length,
          fields,
          processingTime,
          {
            sheets: sheetsToProcess,
            sheetCount: sheetsToProcess.length,
            sheetMetadata,
            types,
            workbookInfo: {
              sheetNames: workbook.SheetNames,
              properties: workbook.Props || {}
            }
          }
        ),
        filename: options.filename
      }
    } catch (error) {
      throw new Error(`Excel parsing failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Determine which sheets to process
   */
  private getSheetsToProcess(workbook: XLSX.WorkBook, options: FormatHandlerOptions): string[] {
    const allSheets = workbook.SheetNames

    // If specific sheets requested
    if (options.excelSheets && options.excelSheets !== 'all') {
      return options.excelSheets.filter(name => allSheets.includes(name))
    }

    // Otherwise process all sheets
    return allSheets
  }

  /**
   * Check if a number is likely an Excel date
   * Excel stores dates as days since 1900-01-01
   */
  private isExcelDate(value: number): boolean {
    // Excel dates are typically between 1 and 60000 (1900 to 2064)
    // This is a heuristic - not perfect but catches most cases
    return value > 0 && value < 100000 && Number.isInteger(value)
  }

  /**
   * Convert Excel date (days since 1900-01-01) to JS Date
   */
  private excelDateToJSDate(excelDate: number): Date {
    // Excel's epoch is 1900-01-01, but there's a bug where it thinks 1900 is a leap year
    // So dates before March 1, 1900 are off by one day
    const epoch = new Date(1899, 11, 30) // Dec 30, 1899
    const msPerDay = 24 * 60 * 60 * 1000
    return new Date(epoch.getTime() + excelDate * msPerDay)
  }
}
