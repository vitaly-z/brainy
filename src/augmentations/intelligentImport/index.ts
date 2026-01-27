/**
 * Intelligent Import Module
 * Exports main augmentation and types
 */

export { IntelligentImportAugmentation } from './IntelligentImportAugmentation.js'
export type {
  FormatHandler,
  FormatHandlerOptions,
  ProcessedData,
  IntelligentImportConfig,
  HandlerRegistry
} from './types.js'

// Format Handlers
export { CSVHandler } from './handlers/csvHandler.js'
export { ExcelHandler } from './handlers/excelHandler.js'
export { PDFHandler } from './handlers/pdfHandler.js'
export { ImageHandler } from './handlers/imageHandler.js'

// Format Handler Registry
export {
  FormatHandlerRegistry,
  globalHandlerRegistry
} from './FormatHandlerRegistry.js'
export type { HandlerRegistration } from './FormatHandlerRegistry.js'

// Image Handler Types
export type {
  ImageMetadata,
  EXIFData,
  ImageHandlerOptions
} from './handlers/imageHandler.js'
