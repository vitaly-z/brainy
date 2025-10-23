import { describe, it, expect } from 'vitest'
import {
  autoDetectPreset,
  getPreset,
  getPresetNames,
  explainPresetChoice,
  createCustomPreset,
  validatePreset,
  formatPreset,
  FAST_PRESET,
  BALANCED_PRESET,
  ACCURATE_PRESET,
  EXPLICIT_PRESET,
  PATTERN_PRESET,
  PRESETS,
  type ImportContext,
  type PresetConfig
} from '../../../src/neural/presets.js'

describe('Presets', () => {
  describe('preset definitions', () => {
    it('should have all 5 presets defined', () => {
      expect(PRESETS).toBeDefined()
      expect(Object.keys(PRESETS)).toHaveLength(5)
      expect(PRESETS.fast).toBe(FAST_PRESET)
      expect(PRESETS.balanced).toBe(BALANCED_PRESET)
      expect(PRESETS.accurate).toBe(ACCURATE_PRESET)
      expect(PRESETS.explicit).toBe(EXPLICIT_PRESET)
      expect(PRESETS.pattern).toBe(PATTERN_PRESET)
    })

    it('should have valid fast preset', () => {
      expect(FAST_PRESET.name).toBe('fast')
      expect(FAST_PRESET.signals.enabled).toEqual(['exact', 'pattern'])
      expect(FAST_PRESET.strategies.enabled).toEqual(['explicit'])
      expect(FAST_PRESET.streaming).toBe(true)
      expect(FAST_PRESET.strategies.earlyTermination).toBe(true)
    })

    it('should have valid balanced preset', () => {
      expect(BALANCED_PRESET.name).toBe('balanced')
      expect(BALANCED_PRESET.signals.enabled).toEqual(['exact', 'embedding', 'pattern'])
      expect(BALANCED_PRESET.strategies.enabled).toEqual(['explicit', 'pattern', 'embedding'])
      expect(BALANCED_PRESET.streaming).toBe(false)
    })

    it('should have valid accurate preset', () => {
      expect(ACCURATE_PRESET.name).toBe('accurate')
      expect(ACCURATE_PRESET.signals.enabled).toEqual(['exact', 'embedding', 'pattern', 'context'])
      expect(ACCURATE_PRESET.strategies.enabled).toEqual(['explicit', 'pattern', 'embedding'])
      expect(ACCURATE_PRESET.strategies.earlyTermination).toBe(false)
    })

    it('should have valid explicit preset', () => {
      expect(EXPLICIT_PRESET.name).toBe('explicit')
      expect(EXPLICIT_PRESET.signals.enabled).toEqual(['exact', 'pattern'])
      expect(EXPLICIT_PRESET.strategies.enabled).toEqual(['explicit', 'pattern'])
      expect(EXPLICIT_PRESET.strategies.minConfidence).toBeGreaterThanOrEqual(0.80)
    })

    it('should have valid pattern preset', () => {
      expect(PATTERN_PRESET.name).toBe('pattern')
      expect(PATTERN_PRESET.signals.enabled).toEqual(['embedding', 'pattern', 'context'])
      expect(PATTERN_PRESET.strategies.enabled).toEqual(['pattern', 'embedding'])
    })
  })

  describe('autoDetectPreset', () => {
    it('should return fast preset for large datasets', () => {
      const context: ImportContext = {
        rowCount: 15000,
        fileSize: 5_000_000
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('fast')
    })

    it('should return fast preset for large files', () => {
      const context: ImportContext = {
        fileSize: 15_000_000
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('fast')
    })

    it('should return accurate preset for small datasets', () => {
      const context: ImportContext = {
        rowCount: 50
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('accurate')
    })

    it('should return explicit preset for Excel with explicit columns', () => {
      const context: ImportContext = {
        fileType: 'excel',
        hasExplicitColumns: true,
        rowCount: 500
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('explicit')
    })

    it('should return explicit preset for CSV with explicit columns', () => {
      const context: ImportContext = {
        fileType: 'csv',
        hasExplicitColumns: true
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('explicit')
    })

    it('should return pattern preset for PDF files', () => {
      const context: ImportContext = {
        fileType: 'pdf',
        rowCount: 200
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('pattern')
    })

    it('should return pattern preset for Markdown files', () => {
      const context: ImportContext = {
        fileType: 'markdown'
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('pattern')
    })

    it('should return pattern preset for narrative content', () => {
      const context: ImportContext = {
        hasNarrativeContent: true,
        rowCount: 300
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('pattern')
    })

    it('should return pattern preset for long definitions', () => {
      const context: ImportContext = {
        avgDefinitionLength: 800,
        fileType: 'csv'
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('pattern')
    })

    it('should return balanced preset for JSON', () => {
      const context: ImportContext = {
        fileType: 'json',
        rowCount: 500
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('balanced')
    })

    it('should return balanced preset for medium datasets', () => {
      const context: ImportContext = {
        fileType: 'excel',
        rowCount: 2000
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('balanced')
    })

    it('should return balanced preset for empty context', () => {
      const preset = autoDetectPreset()
      expect(preset.name).toBe('balanced')
    })

    it('should return balanced preset for unknown file type', () => {
      const context: ImportContext = {
        fileType: 'unknown',
        rowCount: 500
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('balanced')
    })
  })

  describe('getPreset', () => {
    it('should get preset by name', () => {
      expect(getPreset('fast')).toBe(FAST_PRESET)
      expect(getPreset('balanced')).toBe(BALANCED_PRESET)
      expect(getPreset('accurate')).toBe(ACCURATE_PRESET)
      expect(getPreset('explicit')).toBe(EXPLICIT_PRESET)
      expect(getPreset('pattern')).toBe(PATTERN_PRESET)
    })

    it('should be case-insensitive', () => {
      expect(getPreset('FAST')).toBe(FAST_PRESET)
      expect(getPreset('Balanced')).toBe(BALANCED_PRESET)
      expect(getPreset('EXPLICIT')).toBe(EXPLICIT_PRESET)
    })

    it('should throw error for unknown preset', () => {
      expect(() => getPreset('unknown')).toThrow('Unknown preset: unknown')
    })
  })

  describe('getPresetNames', () => {
    it('should return all preset names', () => {
      const names = getPresetNames()
      expect(names).toHaveLength(5)
      expect(names).toContain('fast')
      expect(names).toContain('balanced')
      expect(names).toContain('accurate')
      expect(names).toContain('explicit')
      expect(names).toContain('pattern')
    })
  })

  describe('explainPresetChoice', () => {
    it('should explain large dataset choice', () => {
      const context: ImportContext = {
        rowCount: 15000,
        fileSize: 12_000_000
      }

      const explanation = explainPresetChoice(context)
      expect(explanation).toContain('Large dataset')
      expect(explanation).toContain('15000 rows')
      expect(explanation).toContain('fast preset')
    })

    it('should explain small dataset choice', () => {
      const context: ImportContext = {
        rowCount: 50
      }

      const explanation = explainPresetChoice(context)
      expect(explanation).toContain('Small critical dataset')
      expect(explanation).toContain('50 rows')
      expect(explanation).toContain('accurate preset')
    })

    it('should explain explicit columns choice', () => {
      const context: ImportContext = {
        fileType: 'excel',
        hasExplicitColumns: true
      }

      const explanation = explainPresetChoice(context)
      expect(explanation).toContain('EXCEL')
      expect(explanation).toContain('explicit relationship columns')
      expect(explanation).toContain('explicit preset')
    })

    it('should explain narrative content choice', () => {
      const context: ImportContext = {
        fileType: 'pdf',
        hasNarrativeContent: true
      }

      const explanation = explainPresetChoice(context)
      expect(explanation).toContain('Narrative content')
      expect(explanation).toContain('pattern preset')
    })

    it('should explain default choice', () => {
      const context: ImportContext = {
        rowCount: 500
      }

      const explanation = explainPresetChoice(context)
      expect(explanation).toContain('balanced preset')
    })
  })

  describe('createCustomPreset', () => {
    it('should create custom preset from base', () => {
      const custom = createCustomPreset('balanced', {
        name: 'my-custom',
        batchSize: 2000
      })

      expect(custom.name).toBe('my-custom')
      expect(custom.batchSize).toBe(2000)
      expect(custom.signals).toEqual(BALANCED_PRESET.signals)
      expect(custom.strategies).toEqual(BALANCED_PRESET.strategies)
    })

    it('should override signals', () => {
      const custom = createCustomPreset('fast', {
        signals: {
          enabled: ['embedding'],
          weights: { embedding: 1.0, exact: 0, pattern: 0, context: 0 },
          timeout: 200
        }
      })

      expect(custom.signals.enabled).toEqual(['embedding'])
      expect(custom.signals.timeout).toBe(200)
    })

    it('should override strategies', () => {
      const custom = createCustomPreset('balanced', {
        strategies: {
          enabled: ['pattern'],
          timeout: 500,
          earlyTermination: false,
          minConfidence: 0.75
        }
      })

      expect(custom.strategies.enabled).toEqual(['pattern'])
      expect(custom.strategies.timeout).toBe(500)
      expect(custom.strategies.earlyTermination).toBe(false)
    })

    it('should merge partial signal overrides', () => {
      const custom = createCustomPreset('balanced', {
        signals: {
          timeout: 300
        } as any
      })

      expect(custom.signals.enabled).toEqual(BALANCED_PRESET.signals.enabled)
      expect(custom.signals.timeout).toBe(300)
    })
  })

  describe('validatePreset', () => {
    it('should validate all built-in presets', () => {
      expect(() => validatePreset(FAST_PRESET)).not.toThrow()
      expect(() => validatePreset(BALANCED_PRESET)).not.toThrow()
      expect(() => validatePreset(ACCURATE_PRESET)).not.toThrow()
      expect(() => validatePreset(EXPLICIT_PRESET)).not.toThrow()
      expect(() => validatePreset(PATTERN_PRESET)).not.toThrow()
    })

    it('should reject preset with no signals', () => {
      const invalid: PresetConfig = {
        ...BALANCED_PRESET,
        signals: {
          ...BALANCED_PRESET.signals,
          enabled: []
        }
      }

      expect(() => validatePreset(invalid)).toThrow('at least one enabled signal')
    })

    it('should reject preset with no strategies', () => {
      const invalid: PresetConfig = {
        ...BALANCED_PRESET,
        strategies: {
          ...BALANCED_PRESET.strategies,
          enabled: []
        }
      }

      expect(() => validatePreset(invalid)).toThrow('at least one enabled strategy')
    })

    it('should reject preset with invalid weight sum', () => {
      const invalid: PresetConfig = {
        ...BALANCED_PRESET,
        signals: {
          enabled: ['exact', 'embedding'],
          weights: {
            exact: 0.3,
            embedding: 0.5,
            pattern: 0,
            context: 0
          },
          timeout: 100
        }
      }

      expect(() => validatePreset(invalid)).toThrow('weights must sum to 1.0')
    })

    it('should reject preset with negative timeout', () => {
      const invalid: PresetConfig = {
        ...BALANCED_PRESET,
        signals: {
          ...BALANCED_PRESET.signals,
          timeout: -100
        }
      }

      expect(() => validatePreset(invalid)).toThrow('Timeouts must be positive')
    })

    it('should reject preset with invalid batch size', () => {
      const invalid: PresetConfig = {
        ...BALANCED_PRESET,
        batchSize: 0
      }

      expect(() => validatePreset(invalid)).toThrow('Batch size must be positive')
    })
  })

  describe('formatPreset', () => {
    it('should format preset for display', () => {
      const formatted = formatPreset(BALANCED_PRESET)

      expect(formatted).toContain('Preset: balanced')
      expect(formatted).toContain('Description:')
      expect(formatted).toContain('Signals:')
      expect(formatted).toContain('exact: 40%')
      expect(formatted).toContain('embedding: 35%')
      expect(formatted).toContain('Strategies:')
      expect(formatted).toContain('explicit')
      expect(formatted).toContain('pattern')
      expect(formatted).toContain('embedding')
      expect(formatted).toContain('Streaming: false')
      expect(formatted).toContain('Batch size: 500')
    })

    it('should format fast preset correctly', () => {
      const formatted = formatPreset(FAST_PRESET)

      expect(formatted).toContain('fast')
      expect(formatted).toContain('Streaming: true')
      expect(formatted).toContain('Early termination: true')
    })
  })

  describe('preset priorities', () => {
    it('should prioritize size over explicit columns for large datasets', () => {
      const context: ImportContext = {
        rowCount: 20000,
        fileType: 'excel',
        hasExplicitColumns: true
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('fast') // Size trumps explicit
    })

    it('should prioritize small size over other factors', () => {
      const context: ImportContext = {
        rowCount: 50,
        fileType: 'pdf',
        hasNarrativeContent: true
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('accurate') // Small size trumps pattern
    })

    it('should prioritize explicit columns over narrative for Excel', () => {
      const context: ImportContext = {
        rowCount: 500,
        fileType: 'excel',
        hasExplicitColumns: true,
        hasNarrativeContent: true
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('explicit') // Explicit trumps narrative
    })
  })

  describe('edge cases', () => {
    it('should handle zero row count', () => {
      const context: ImportContext = {
        rowCount: 0,
        fileType: 'csv'
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('balanced')
    })

    it('should handle boundary row count (exactly 100)', () => {
      const context: ImportContext = {
        rowCount: 100
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('balanced') // Not accurate (< 100)
    })

    it('should handle boundary row count (exactly 10000)', () => {
      const context: ImportContext = {
        rowCount: 10000
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('balanced') // Not fast (> 10000)
    })

    it('should handle missing hasExplicitColumns flag', () => {
      const context: ImportContext = {
        fileType: 'excel',
        rowCount: 500
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('balanced')
    })
  })

  describe('real-world scenarios', () => {
    it('should handle Workshop glossary correctly', () => {
      const context: ImportContext = {
        fileType: 'excel',
        rowCount: 567,
        hasExplicitColumns: true, // Has "Related Terms" column
        fileSize: 50_000
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('explicit')

      const explanation = explainPresetChoice(context)
      expect(explanation).toContain('explicit')
    })

    it('should handle large CSV import', () => {
      const context: ImportContext = {
        fileType: 'csv',
        rowCount: 50000,
        fileSize: 25_000_000
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('fast')
      expect(preset.streaming).toBe(true)
    })

    it('should handle PDF documentation', () => {
      const context: ImportContext = {
        fileType: 'pdf',
        rowCount: 150,
        hasNarrativeContent: true,
        avgDefinitionLength: 600
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('pattern')
    })

    it('should handle JSON API import', () => {
      const context: ImportContext = {
        fileType: 'json',
        rowCount: 1000,
        fileSize: 500_000
      }

      const preset = autoDetectPreset(context)
      expect(preset.name).toBe('balanced')
    })
  })
})
