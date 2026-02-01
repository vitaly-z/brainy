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
import { FormatHandlerOptions, ProcessedData } from './types.js'

export class ExcelHandler extends BaseFormatHandler {
  readonly format = 'excel'

  canHandle(data: Buffer | string | { filename?: string, ext?: string }): boolean {
    const ext = this.detectExtension(data)
    return ['xlsx', 'xls', 'xlsb', 'xlsm', 'xlt', 'xltx', 'xltm'].includes(ext || '')
  }

  async process(data: Buffer | string, options: FormatHandlerOptions): Promise<ProcessedData> {
    const startTime = Date.now()
    const progressHooks = options.progressHooks

    // Convert to buffer if string (though Excel should always be binary)
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'binary')
    const totalBytes = buffer.length

    // Report start
    if (progressHooks?.onBytesProcessed) {
      progressHooks.onBytesProcessed(0)
    }
    if (progressHooks?.onCurrentItem) {
      progressHooks.onCurrentItem('Loading Excel workbook...')
    }

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

      // Report workbook loaded
      if (progressHooks?.onCurrentItem) {
        progressHooks.onCurrentItem(`Processing ${sheetsToProcess.length} sheets...`)
      }

      // Extract data from sheets
      const allData: Array<Record<string, any>> = []
      const sheetMetadata: Record<string, any> = {}

      for (let sheetIndex = 0; sheetIndex < sheetsToProcess.length; sheetIndex++) {
        const sheetName = sheetsToProcess[sheetIndex]

        // Report current sheet
        if (progressHooks?.onCurrentItem) {
          progressHooks.onCurrentItem(
            `Reading sheet: ${sheetName} (${sheetIndex + 1}/${sheetsToProcess.length})`
          )
        }

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

        // Estimate bytes processed (sheets are sequential)
        const bytesProcessed = Math.floor(((sheetIndex + 1) / sheetsToProcess.length) * totalBytes)
        if (progressHooks?.onBytesProcessed) {
          progressHooks.onBytesProcessed(bytesProcessed)
        }

        // Report extraction progress
        if (progressHooks?.onDataExtracted) {
          progressHooks.onDataExtracted(allData.length, undefined) // Total unknown until complete
        }
      }

      // Report data extraction complete
      if (progressHooks?.onCurrentItem) {
        progressHooks.onCurrentItem(`Extracted ${allData.length} rows, inferring types...`)
      }
      if (progressHooks?.onDataExtracted) {
        progressHooks.onDataExtracted(allData.length, allData.length)
      }

      // Infer types (excluding _sheet field)
      const fields = allData.length > 0 ? Object.keys(allData[0]).filter(k => k !== '_sheet') : []
      const types = this.inferFieldTypes(allData)

      // Convert values to appropriate types
      const convertedData = allData.map((row, index) => {
        const converted: Record<string, any> = {}
        for (const [key, value] of Object.entries(row)) {
          if (key === '_sheet') {
            converted[key] = value
          } else {
            converted[key] = this.convertValue(value, types[key] || 'string')
          }
        }

        // Report progress every 1000 rows (avoid spam)
        if (progressHooks?.onCurrentItem && index > 0 && index % 1000 === 0) {
          progressHooks.onCurrentItem(`Converting types: ${index}/${allData.length} rows...`)
        }

        return converted
      })

      // Final progress - all bytes processed
      if (progressHooks?.onBytesProcessed) {
        progressHooks.onBytesProcessed(totalBytes)
      }

      const processingTime = Date.now() - startTime

      // Report completion
      if (progressHooks?.onCurrentItem) {
        progressHooks.onCurrentItem(
          `Excel complete: ${sheetsToProcess.length} sheets, ${convertedData.length} rows`
        )
      }

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
