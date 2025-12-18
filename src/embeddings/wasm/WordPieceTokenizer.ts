/**
 * WordPiece Tokenizer for BERT-based models
 *
 * Implements the WordPiece tokenization algorithm used by all-MiniLM-L6-v2.
 * This is a clean, dependency-free implementation.
 *
 * Algorithm:
 * 1. Normalize text (lowercase for uncased models)
 * 2. Split on whitespace and punctuation
 * 3. Apply WordPiece subword tokenization
 * 4. Add special tokens ([CLS], [SEP])
 * 5. Generate attention mask
 */

import {
  TokenizerConfig,
  TokenizedInput,
  SPECIAL_TOKENS,
  MODEL_CONSTANTS,
} from './types.js'

/**
 * WordPiece tokenizer for BERT-based sentence transformers
 */
export class WordPieceTokenizer {
  private vocab: Map<string, number>
  private reverseVocab: Map<number, string>
  private config: TokenizerConfig

  constructor(vocab: Map<string, number> | Record<string, number>, config?: Partial<TokenizerConfig>) {
    // Convert Record to Map if needed
    this.vocab = vocab instanceof Map ? vocab : new Map(Object.entries(vocab))

    // Build reverse vocab for debugging
    this.reverseVocab = new Map()
    for (const [token, id] of this.vocab) {
      this.reverseVocab.set(id, token)
    }

    // Default config for all-MiniLM-L6-v2
    this.config = {
      vocab: this.vocab,
      unkTokenId: config?.unkTokenId ?? SPECIAL_TOKENS.UNK,
      clsTokenId: config?.clsTokenId ?? SPECIAL_TOKENS.CLS,
      sepTokenId: config?.sepTokenId ?? SPECIAL_TOKENS.SEP,
      padTokenId: config?.padTokenId ?? SPECIAL_TOKENS.PAD,
      maxLength: config?.maxLength ?? MODEL_CONSTANTS.MAX_SEQUENCE_LENGTH,
      doLowerCase: config?.doLowerCase ?? true,
    }
  }

  /**
   * Tokenize text into token IDs
   */
  encode(text: string): TokenizedInput {
    // 1. Normalize
    let normalizedText = text
    if (this.config.doLowerCase) {
      normalizedText = text.toLowerCase()
    }

    // 2. Clean and split into words
    const words = this.basicTokenize(normalizedText)

    // 3. Apply WordPiece to each word
    const tokens: number[] = [this.config.clsTokenId]

    for (const word of words) {
      const wordTokens = this.wordPieceTokenize(word)
      // Check if adding these tokens would exceed max length (accounting for [SEP])
      if (tokens.length + wordTokens.length + 1 > this.config.maxLength) {
        break
      }
      tokens.push(...wordTokens)
    }

    tokens.push(this.config.sepTokenId)

    // 4. Generate attention mask and token type IDs
    const attentionMask = new Array(tokens.length).fill(1)
    const tokenTypeIds = new Array(tokens.length).fill(0)

    return {
      inputIds: tokens,
      attentionMask,
      tokenTypeIds,
      tokenCount: tokens.length - 2, // Exclude [CLS] and [SEP]
    }
  }

  /**
   * Encode with padding to fixed length
   */
  encodeWithPadding(text: string, targetLength?: number): TokenizedInput {
    const result = this.encode(text)
    const padLength = targetLength ?? this.config.maxLength

    // Pad to target length
    while (result.inputIds.length < padLength) {
      result.inputIds.push(this.config.padTokenId)
      result.attentionMask.push(0)
      result.tokenTypeIds.push(0)
    }

    // Truncate if longer (shouldn't happen with proper encode())
    if (result.inputIds.length > padLength) {
      result.inputIds.length = padLength
      result.attentionMask.length = padLength
      result.tokenTypeIds.length = padLength
      // Ensure [SEP] is at the end
      result.inputIds[padLength - 1] = this.config.sepTokenId
      result.attentionMask[padLength - 1] = 1
    }

    return result
  }

  /**
   * Batch encode multiple texts
   */
  encodeBatch(texts: string[]): {
    inputIds: number[][]
    attentionMask: number[][]
    tokenTypeIds: number[][]
  } {
    const results = texts.map((text) => this.encode(text))

    // Find max length in batch
    const maxLen = Math.max(...results.map((r) => r.inputIds.length))

    // Pad all to same length
    const inputIds: number[][] = []
    const attentionMask: number[][] = []
    const tokenTypeIds: number[][] = []

    for (const result of results) {
      const padded = this.encodeWithPadding(
        '', // Not used since we're modifying result
        maxLen
      )
      // Copy original values
      for (let i = 0; i < result.inputIds.length; i++) {
        padded.inputIds[i] = result.inputIds[i]
        padded.attentionMask[i] = result.attentionMask[i]
        padded.tokenTypeIds[i] = result.tokenTypeIds[i]
      }
      // Pad the rest
      for (let i = result.inputIds.length; i < maxLen; i++) {
        padded.inputIds[i] = this.config.padTokenId
        padded.attentionMask[i] = 0
        padded.tokenTypeIds[i] = 0
      }
      inputIds.push(padded.inputIds.slice(0, maxLen))
      attentionMask.push(padded.attentionMask.slice(0, maxLen))
      tokenTypeIds.push(padded.tokenTypeIds.slice(0, maxLen))
    }

    return { inputIds, attentionMask, tokenTypeIds }
  }

  /**
   * Basic tokenization: split on whitespace and punctuation
   */
  private basicTokenize(text: string): string[] {
    // Clean whitespace
    text = text.trim().replace(/\s+/g, ' ')

    if (!text) {
      return []
    }

    const words: string[] = []
    let currentWord = ''

    for (const char of text) {
      if (this.isWhitespace(char)) {
        if (currentWord) {
          words.push(currentWord)
          currentWord = ''
        }
      } else if (this.isPunctuation(char)) {
        if (currentWord) {
          words.push(currentWord)
          currentWord = ''
        }
        words.push(char)
      } else {
        currentWord += char
      }
    }

    if (currentWord) {
      words.push(currentWord)
    }

    return words
  }

  /**
   * WordPiece tokenization for a single word
   */
  private wordPieceTokenize(word: string): number[] {
    if (!word) {
      return []
    }

    // Check if whole word is in vocabulary
    if (this.vocab.has(word)) {
      return [this.vocab.get(word)!]
    }

    const tokens: number[] = []
    let start = 0

    while (start < word.length) {
      let end = word.length
      let foundToken = false

      while (start < end) {
        let substr = word.slice(start, end)

        // Add ## prefix for subwords (not at start of word)
        if (start > 0) {
          substr = '##' + substr
        }

        if (this.vocab.has(substr)) {
          tokens.push(this.vocab.get(substr)!)
          foundToken = true
          break
        }

        end--
      }

      if (!foundToken) {
        // Unknown character - use [UNK] for single character
        tokens.push(this.config.unkTokenId)
        start++
      } else {
        start = end
      }
    }

    return tokens
  }

  /**
   * Check if character is whitespace
   */
  private isWhitespace(char: string): boolean {
    return /\s/.test(char)
  }

  /**
   * Check if character is punctuation
   */
  private isPunctuation(char: string): boolean {
    const code = char.charCodeAt(0)
    // ASCII punctuation ranges
    if (
      (code >= 33 && code <= 47) || // !"#$%&'()*+,-./
      (code >= 58 && code <= 64) || // :;<=>?@
      (code >= 91 && code <= 96) || // [\]^_`
      (code >= 123 && code <= 126) // {|}~
    ) {
      return true
    }
    // Unicode punctuation categories
    return /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-./:;<=>?@\[\]^_`{|}~]/.test(char)
  }

  /**
   * Decode token IDs back to text (for debugging)
   */
  decode(tokenIds: number[]): string {
    const tokens: string[] = []
    for (const id of tokenIds) {
      const token = this.reverseVocab.get(id)
      if (token && !['[CLS]', '[SEP]', '[PAD]'].includes(token)) {
        if (token.startsWith('##')) {
          // Subword - append without space
          if (tokens.length > 0) {
            tokens[tokens.length - 1] += token.slice(2)
          } else {
            tokens.push(token.slice(2))
          }
        } else {
          tokens.push(token)
        }
      }
    }
    return tokens.join(' ')
  }

  /**
   * Get vocabulary size
   */
  get vocabSize(): number {
    return this.vocab.size
  }

  /**
   * Get max sequence length
   */
  get maxLength(): number {
    return this.config.maxLength
  }
}

/**
 * Create tokenizer from vocabulary JSON
 */
export function createTokenizer(vocabJson: Record<string, number>): WordPieceTokenizer {
  return new WordPieceTokenizer(vocabJson)
}
