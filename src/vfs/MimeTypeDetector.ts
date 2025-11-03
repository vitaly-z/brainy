/**
 * MIME Type Detection Service (v5.2.0)
 *
 * Provides comprehensive MIME type detection using:
 * 1. Industry-standard `mime` library (2000+ IANA types)
 * 2. Custom mappings for developer-specific files
 *
 * Replaces hardcoded MIME dictionaries with maintainable, extensible solution.
 */

import mime from 'mime'

/**
 * MIME Type Detector with comprehensive file type coverage
 *
 * Handles 2000+ standard types plus custom developer formats
 */
export class MimeTypeDetector {
  private customTypes: Map<string, string>

  constructor() {
    // Custom MIME types for developer-specific files not in IANA registry
    this.customTypes = new Map([
      // Shell scripts (various shells)
      ['.bash', 'text/x-shellscript'],
      ['.zsh', 'text/x-shellscript'],
      ['.fish', 'text/x-shellscript'],
      ['.ksh', 'text/x-shellscript'],
      ['.csh', 'application/x-csh'], // IANA registered

      // Core programming languages (override mime library)
      ['.ts', 'text/typescript'],
      ['.tsx', 'text/typescript'],
      ['.js', 'text/javascript'],
      ['.jsx', 'text/javascript'],
      ['.mjs', 'text/javascript'],
      ['.py', 'text/x-python'],
      ['.go', 'text/x-go'],
      ['.rs', 'text/x-rust'],
      ['.java', 'text/x-java'],
      ['.c', 'text/x-c'],
      ['.cpp', 'text/x-c++'],
      ['.cc', 'text/x-c++'],
      ['.cxx', 'text/x-c++'],
      ['.c++', 'text/x-c++'],
      ['.h', 'text/x-c'],
      ['.hpp', 'text/x-c++'],

      // Data formats (override mime library for consistency)
      ['.xml', 'text/xml'],

      // Modern programming languages
      ['.kt', 'text/x-kotlin'],
      ['.kts', 'text/x-kotlin'],
      ['.swift', 'text/x-swift'],
      ['.dart', 'text/x-dart'],
      ['.lua', 'text/x-lua'],
      ['.scala', 'text/x-scala'],
      ['.r', 'text/x-r'],

      // Configuration files
      ['.env', 'text/x-env'],
      ['.ini', 'text/x-ini'],
      ['.conf', 'text/plain'],
      ['.properties', 'text/x-java-properties'],
      ['.config', 'text/plain'],
      ['.editorconfig', 'text/plain'],
      ['.gitignore', 'text/plain'],
      ['.dockerignore', 'text/plain'],
      ['.npmignore', 'text/plain'],
      ['.eslintrc', 'application/json'],
      ['.prettierrc', 'application/json'],

      // Build/project files
      ['.gradle', 'text/x-gradle'],
      ['.cmake', 'text/x-cmake'],
      ['.dockerfile', 'text/x-dockerfile'],

      // Web framework components
      ['.vue', 'text/x-vue'],
      ['.svelte', 'text/x-svelte'],
      ['.astro', 'text/x-astro'],

      // Style preprocessors
      ['.scss', 'text/x-scss'],
      ['.sass', 'text/x-sass'],
      ['.less', 'text/x-less'],
      ['.styl', 'text/x-stylus'],

      // Big data / modern data formats
      ['.parquet', 'application/vnd.apache.parquet'],
      ['.avro', 'application/avro'],
      ['.proto', 'text/x-protobuf'],
      ['.arrow', 'application/vnd.apache.arrow.file'],
      ['.msgpack', 'application/msgpack'],
      ['.cbor', 'application/cbor'],

      // Additional programming languages
      ['.m', 'text/x-objective-c'],
      ['.vim', 'text/x-vim'],
      ['.ex', 'text/x-elixir'],
      ['.exs', 'text/x-elixir'],
      ['.clj', 'text/x-clojure'],
      ['.cljs', 'text/x-clojure'],
      ['.hs', 'text/x-haskell'],
      ['.erl', 'text/x-erlang'],

      // Markup/documentation
      ['.rst', 'text/x-rst'],
      ['.rest', 'text/x-rst'],
      ['.adoc', 'text/x-asciidoc'],
      ['.asciidoc', 'text/x-asciidoc'],

      // Office formats (OpenXML - Microsoft Office)
      ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['.docm', 'application/vnd.ms-word.document.macroEnabled.12'],
      ['.dotx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.template'],
      ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['.xlsm', 'application/vnd.ms-excel.sheet.macroEnabled.12'],
      ['.xltx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.template'],
      ['.xlsb', 'application/vnd.ms-excel.sheet.binary.macroEnabled.12'],
      ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      ['.pptm', 'application/vnd.ms-powerpoint.presentation.macroEnabled.12'],

      // Office formats (ODF - OpenDocument)
      ['.odt', 'application/vnd.oasis.opendocument.text'],
      ['.ods', 'application/vnd.oasis.opendocument.spreadsheet'],
      ['.odp', 'application/vnd.oasis.opendocument.presentation'],
      ['.odg', 'application/vnd.oasis.opendocument.graphics'],
      ['.odf', 'application/vnd.oasis.opendocument.formula'],
      ['.odb', 'application/vnd.oasis.opendocument.database']
    ])
  }

  /**
   * Detect MIME type from filename
   *
   * @param filename - File name with extension
   * @param content - Optional file content (for future content-based detection)
   * @returns MIME type string (e.g., 'text/typescript', 'application/json')
   */
  detectMimeType(filename: string, content?: Buffer): string {
    // Normalize filename for special cases
    const normalizedFilename = this.normalizeFilename(filename)
    const ext = this.getExtension(normalizedFilename)

    // 1. Check custom types first (highest priority)
    if (ext && this.customTypes.has(ext)) {
      return this.customTypes.get(ext)!
    }

    // 2. Use mime library for standard IANA types
    const standardType = mime.getType(normalizedFilename)
    if (standardType) {
      return standardType
    }

    // 3. Special handling for files without extensions
    const basename = this.getBasename(filename)
    if (this.isSpecialFilename(basename)) {
      return this.getSpecialFilenameType(basename)
    }

    // 4. Fallback to generic binary
    return 'application/octet-stream'
  }

  /**
   * Check if MIME type represents a text file
   *
   * Text files get full content embeddings for semantic search.
   * Binary files get description-only embeddings.
   *
   * @param mimeType - MIME type string
   * @returns true if text file, false if binary
   */
  isTextFile(mimeType: string): boolean {
    return (
      mimeType.startsWith('text/') ||
      mimeType.includes('json') ||
      mimeType.includes('javascript') ||
      mimeType.includes('typescript') ||
      mimeType.includes('xml') ||
      mimeType.includes('yaml') ||
      mimeType.includes('sql') ||
      mimeType === 'application/json' ||
      mimeType === 'application/xml'
    )
  }

  /**
   * Get file extension from filename
   *
   * @param filename - File name
   * @returns Extension with dot (e.g., '.ts') or undefined
   */
  private getExtension(filename: string): string | undefined {
    const lastDot = filename.lastIndexOf('.')
    if (lastDot === -1 || lastDot === 0) return undefined
    return filename.substring(lastDot).toLowerCase()
  }

  /**
   * Get basename from filename (without path)
   *
   * @param filename - Full file path or name
   * @returns Basename (e.g., 'Dockerfile' from '/path/to/Dockerfile')
   */
  private getBasename(filename: string): string {
    const lastSlash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'))
    return lastSlash === -1 ? filename : filename.substring(lastSlash + 1)
  }

  /**
   * Normalize filename for special cases
   *
   * Handles files like 'Dockerfile', 'Makefile', '.gitignore'
   *
   * @param filename - Original filename
   * @returns Normalized filename with extension if special case
   */
  private normalizeFilename(filename: string): string {
    const basename = this.getBasename(filename).toLowerCase()

    // Special files without extensions
    const specialFiles: Record<string, string> = {
      'dockerfile': '.dockerfile',
      'makefile': '.makefile',
      'gemfile': '.gemfile',
      'rakefile': '.rakefile',
      'vagrantfile': '.vagrantfile'
    }

    if (specialFiles[basename]) {
      return filename + specialFiles[basename]
    }

    return filename
  }

  /**
   * Check if filename is a special case (no extension but known type)
   *
   * @param basename - File basename
   * @returns true if special filename
   */
  private isSpecialFilename(basename: string): boolean {
    const lower = basename.toLowerCase()
    return (
      lower === 'dockerfile' ||
      lower === 'makefile' ||
      lower === 'gemfile' ||
      lower === 'rakefile' ||
      lower === 'vagrantfile' ||
      lower === '.env' ||
      lower === '.editorconfig' ||
      lower.startsWith('.git') ||
      lower.startsWith('.npm') ||
      lower.startsWith('.docker') ||
      lower.startsWith('.eslint') ||
      lower.startsWith('.prettier')
    )
  }

  /**
   * Get MIME type for special filename
   *
   * @param basename - File basename
   * @returns MIME type
   */
  private getSpecialFilenameType(basename: string): string {
    const lower = basename.toLowerCase()

    if (lower === 'dockerfile') return 'text/x-dockerfile'
    if (lower === 'makefile') return 'text/x-makefile'
    if (lower === 'gemfile' || lower === 'rakefile') return 'text/x-ruby'
    if (lower === 'vagrantfile') return 'text/x-ruby'
    if (lower === '.env') return 'text/x-env'

    // Other dotfiles are usually config files
    return 'text/plain'
  }
}

/**
 * Singleton instance for global use
 *
 * Usage:
 *   import { mimeDetector } from './MimeTypeDetector'
 *   const type = mimeDetector.detectMimeType('file.ts')
 */
export const mimeDetector = new MimeTypeDetector()
