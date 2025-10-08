/**
 * Smart Import System
 *
 * Production-ready entity and relationship extraction from multiple formats:
 * - Excel (.xlsx)
 * - PDF (.pdf)
 * - CSV (.csv)
 * - JSON (.json)
 * - Markdown (.md)
 *
 * Uses brainy's built-in NeuralEntityExtractor and NaturalLanguageProcessor
 *
 * NO MOCKS - Real working implementation
 */

// Excel Importer
export { SmartExcelImporter } from './SmartExcelImporter.js'
export type {
  SmartExcelOptions,
  ExtractedRow,
  SmartExcelResult
} from './SmartExcelImporter.js'

// PDF Importer
export { SmartPDFImporter } from './SmartPDFImporter.js'
export type {
  SmartPDFOptions,
  ExtractedSection,
  SmartPDFResult
} from './SmartPDFImporter.js'

// CSV Importer
export { SmartCSVImporter } from './SmartCSVImporter.js'
export type {
  SmartCSVOptions,
  SmartCSVResult
} from './SmartCSVImporter.js'

// JSON Importer
export { SmartJSONImporter } from './SmartJSONImporter.js'
export type {
  SmartJSONOptions,
  ExtractedJSONEntity,
  ExtractedJSONRelationship,
  SmartJSONResult
} from './SmartJSONImporter.js'

// Markdown Importer
export { SmartMarkdownImporter } from './SmartMarkdownImporter.js'
export type {
  SmartMarkdownOptions,
  MarkdownSection,
  SmartMarkdownResult
} from './SmartMarkdownImporter.js'

// VFS Structure Generator
export { VFSStructureGenerator } from './VFSStructureGenerator.js'
export type {
  VFSStructureOptions,
  VFSStructureResult
} from './VFSStructureGenerator.js'

// Orchestrator (Main entry point)
export { SmartImportOrchestrator } from './SmartImportOrchestrator.js'
export type {
  SmartImportOptions,
  SmartImportProgress,
  SmartImportResult
} from './SmartImportOrchestrator.js'
