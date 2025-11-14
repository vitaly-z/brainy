/**
 * ImageHandler Tests (v5.8.0 - Pure JavaScript)
 *
 * Tests for image processing with EXIF extraction and metadata extraction
 * Using probe-image-size + exifr (no native dependencies)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ImageHandler } from '../../../src/augmentations/intelligentImport/handlers/imageHandler.js'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('ImageHandler (v5.8.0 - Pure JS)', () => {
  let handler: ImageHandler

  // Simple test image generators (minimal PNG/JPEG headers)
  const createMinimalJPEG = (width: number = 100, height: number = 100): Buffer => {
    // Minimal JPEG: SOI + SOF0 + EOI
    // This is a valid but minimal JPEG structure
    const soi = Buffer.from([0xFF, 0xD8]) // Start of Image
    const sof0 = Buffer.from([
      0xFF, 0xC0, // SOF0 marker
      0x00, 0x11, // Length: 17 bytes
      0x08, // Precision: 8 bits
      (height >> 8) & 0xFF, height & 0xFF, // Height
      (width >> 8) & 0xFF, width & 0xFF, // Width
      0x03, // Components: 3 (YCbCr)
      0x01, 0x22, 0x00, // Y component
      0x02, 0x11, 0x01, // Cb component
      0x03, 0x11, 0x01  // Cr component
    ])
    const eoi = Buffer.from([0xFF, 0xD9]) // End of Image

    return Buffer.concat([soi, sof0, eoi])
  }

  const createMinimalPNG = (width: number = 100, height: number = 100): Buffer => {
    // PNG signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

    // IHDR chunk
    const ihdr = Buffer.alloc(25)
    ihdr.writeUInt32BE(13, 0) // Length
    ihdr.write('IHDR', 4)
    ihdr.writeUInt32BE(width, 8)
    ihdr.writeUInt32BE(height, 12)
    ihdr.writeUInt8(8, 16) // Bit depth
    ihdr.writeUInt8(2, 17) // Color type (RGB)
    ihdr.writeUInt8(0, 18) // Compression
    ihdr.writeUInt8(0, 19) // Filter
    ihdr.writeUInt8(0, 20) // Interlace
    ihdr.writeUInt32BE(0, 21) // CRC (simplified)

    // IEND chunk
    const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130])

    return Buffer.concat([signature, ihdr, iend])
  }

  beforeEach(() => {
    handler = new ImageHandler()
  })

  describe('Handler Detection', () => {
    it('should identify as image format handler', () => {
      expect(handler.format).toBe('image')
    })

    it('should handle JPEG files by filename', () => {
      expect(handler.canHandle({ filename: 'photo.jpg' })).toBe(true)
      expect(handler.canHandle({ filename: 'photo.jpeg' })).toBe(true)
    })

    it('should handle PNG files by filename', () => {
      expect(handler.canHandle({ filename: 'logo.png' })).toBe(true)
    })

    it('should handle WebP files by filename', () => {
      expect(handler.canHandle({ filename: 'image.webp' })).toBe(true)
    })

    it('should handle other image formats', () => {
      expect(handler.canHandle({ filename: 'photo.gif' })).toBe(true)
      expect(handler.canHandle({ filename: 'photo.tiff' })).toBe(true)
      expect(handler.canHandle({ filename: 'photo.bmp' })).toBe(true)
      expect(handler.canHandle({ filename: 'icon.svg' })).toBe(true)
    })

    it('should handle images by extension', () => {
      expect(handler.canHandle({ ext: '.jpg' })).toBe(true)
      expect(handler.canHandle({ ext: 'png' })).toBe(true)
    })

    it('should reject non-image files', () => {
      expect(handler.canHandle({ filename: 'document.pdf' })).toBe(false)
      expect(handler.canHandle({ filename: 'data.csv' })).toBe(false)
      expect(handler.canHandle({ filename: 'text.txt' })).toBe(false)
    })

    it('should detect JPEG by magic bytes', () => {
      const jpegBuffer = createMinimalJPEG(100, 100)
      expect(handler.canHandle(jpegBuffer)).toBe(true)
    })

    it('should detect PNG by magic bytes', () => {
      const pngBuffer = createMinimalPNG(100, 100)
      expect(handler.canHandle(pngBuffer)).toBe(true)
    })
  })

  describe('Image Metadata Extraction', () => {
    it('should extract JPEG metadata', async () => {
      const imageBuffer = createMinimalJPEG(800, 600)

      const result = await handler.process(imageBuffer, {
        extractEXIF: false
      })

      expect(result.format).toBe('image')
      expect(result.data).toHaveLength(1)

      const imageData = result.data[0]
      expect(imageData.type).toBe('media')
      expect(imageData.metadata).toBeDefined()
      expect(imageData.metadata.subtype).toBe('image')
      expect(imageData.metadata.width).toBe(800)
      expect(imageData.metadata.height).toBe(600)
      expect(imageData.metadata.format).toBe('jpg') // probe-image-size uses 'jpg' not 'jpeg'
    })

    it('should extract PNG metadata', async () => {
      const imageBuffer = createMinimalPNG(400, 300)

      const result = await handler.process(imageBuffer, {
        extractEXIF: false
      })

      const imageData = result.data[0]
      expect(imageData.metadata.width).toBe(400)
      expect(imageData.metadata.height).toBe(300)
      expect(imageData.metadata.format).toBe('png')
    })

    it('should include image size in bytes', async () => {
      const imageBuffer = createMinimalJPEG(200, 200)

      const result = await handler.process(imageBuffer, {
        extractEXIF: false
      })

      const imageData = result.data[0]
      expect(imageData.metadata.size).toBe(imageBuffer.length)
      expect(imageData.metadata.size).toBeGreaterThan(0)
    })

    it('should include MIME type when available', async () => {
      const imageBuffer = createMinimalJPEG(100, 100)

      const result = await handler.process(imageBuffer, {
        extractEXIF: false
      })

      const imageData = result.data[0]
      expect(imageData.metadata.mimeType).toBeDefined()
      expect(imageData.metadata.mimeType).toContain('image/')
    })

    it('should include processing time in metadata', async () => {
      const imageBuffer = createMinimalJPEG(800, 600)

      const result = await handler.process(imageBuffer)

      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0)
      expect(result.metadata.processingTime).toBeLessThan(5000)
    })

    it('should include image metadata in result metadata', async () => {
      const imageBuffer = createMinimalJPEG(800, 600)

      const result = await handler.process(imageBuffer)

      expect(result.metadata.imageMetadata).toBeDefined()
      expect(result.metadata.imageMetadata.width).toBe(800)
      expect(result.metadata.imageMetadata.height).toBe(600)
    })
  })

  describe('EXIF Data Extraction', () => {
    it('should handle images without EXIF data', async () => {
      const imageBuffer = createMinimalJPEG(800, 600)

      const result = await handler.process(imageBuffer, {
        extractEXIF: true
      })

      const imageData = result.data[0]
      // Should not crash, EXIF will be undefined
      expect(imageData.metadata.exif).toBeUndefined()
    })

    it('should extract EXIF by default', async () => {
      const imageBuffer = createMinimalJPEG(800, 600)

      // Default: EXIF extraction enabled
      const result = await handler.process(imageBuffer)

      // Will be undefined for test images, but should not crash
      expect(result.metadata.exifData).toBeUndefined()
    })

    it('should allow disabling EXIF extraction', async () => {
      const imageBuffer = createMinimalJPEG(800, 600)

      const result = await handler.process(imageBuffer, {
        extractEXIF: false
      })

      const imageData = result.data[0]
      expect(imageData.metadata.exif).toBeUndefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid image data gracefully', async () => {
      const invalidBuffer = Buffer.from('not an image', 'utf-8')

      // Should still process but with fallback values
      const result = await handler.process(invalidBuffer, { extractEXIF: false })

      // Fallback detection should provide basic info
      expect(result.data[0].metadata.format).toBeDefined()
      expect(result.data[0].metadata.size).toBe(invalidBuffer.length)
    })

    it('should handle empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0)

      // Should not crash, but will have unknown format
      const result = await handler.process(emptyBuffer, { extractEXIF: false })
      expect(result.data[0].metadata.format).toBe('unknown')
    })
  })

  describe('Format Support', () => {
    it('should process JPEG images', async () => {
      const imageBuffer = createMinimalJPEG(200, 200)

      const result = await handler.process(imageBuffer, {
        extractEXIF: false
      })

      expect(result.data[0].metadata.format).toBe('jpg') // probe-image-size uses 'jpg' not 'jpeg'
    })

    it('should process PNG images', async () => {
      const imageBuffer = createMinimalPNG(200, 200)

      const result = await handler.process(imageBuffer, {
        extractEXIF: false
      })

      expect(result.data[0].metadata.format).toBe('png')
    })

    it('should handle various image dimensions', async () => {
      const sizes = [
        [100, 100],
        [1920, 1080],
        [400, 300],
        [1000, 500]
      ]

      for (const [width, height] of sizes) {
        const imageBuffer = createMinimalJPEG(width, height)
        const result = await handler.process(imageBuffer, { extractEXIF: false })

        expect(result.data[0].metadata.width).toBe(width)
        expect(result.data[0].metadata.height).toBe(height)
      }
    })
  })

  describe('Integration with BaseFormatHandler', () => {
    it('should inherit MIME type detection from BaseFormatHandler', () => {
      // getMimeType is protected, but we can verify behavior
      expect(handler.canHandle({ filename: 'test.jpg' })).toBe(true)
      expect(handler.canHandle({ filename: 'test.png' })).toBe(true)
    })

    it('should provide structured ProcessedData', async () => {
      const imageBuffer = createMinimalJPEG(200, 200)

      const result = await handler.process(imageBuffer, {
        filename: 'test-image.jpg',
        extractEXIF: false
      })

      // Verify ProcessedData structure
      expect(result.format).toBe('image')
      expect(result.data).toBeInstanceOf(Array)
      expect(result.metadata).toBeDefined()
      expect(result.filename).toBe('test-image.jpg')

      // Verify data structure
      const entity = result.data[0]
      expect(entity.name).toBe('test-image')
      expect(entity.type).toBe('media')
      expect(entity.metadata).toBeDefined()
    })
  })
})
