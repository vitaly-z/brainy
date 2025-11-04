/**
 * ImageHandler Tests (v5.2.0)
 *
 * Tests for image processing with EXIF extraction and metadata extraction
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ImageHandler } from '../../../src/augmentations/intelligentImport/handlers/imageHandler.js'
import sharp from 'sharp'

describe('ImageHandler (v5.2.0)', () => {
  let handler: ImageHandler

  // Create test images programmatically
  const createTestImage = async (
    width: number,
    height: number,
    format: 'jpeg' | 'png' | 'webp' = 'jpeg'
  ): Promise<Buffer> => {
    // Create a simple colored rectangle
    const channels = format === 'png' ? 4 : 3 // PNG has alpha, JPEG doesn't
    const pixelData = Buffer.alloc(width * height * channels)

    // Fill with gradient colors
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * channels
        pixelData[i] = Math.floor((x / width) * 255) // Red gradient
        pixelData[i + 1] = Math.floor((y / height) * 255) // Green gradient
        pixelData[i + 2] = 128 // Blue constant
        if (channels === 4) {
          pixelData[i + 3] = 255 // Alpha (opaque)
        }
      }
    }

    // Convert raw pixel data to image format
    let image = sharp(pixelData, {
      raw: {
        width,
        height,
        channels
      }
    })

    if (format === 'jpeg') {
      image = image.jpeg({ quality: 90 })
    } else if (format === 'png') {
      image = image.png()
    } else if (format === 'webp') {
      image = image.webp({ quality: 90 })
    }

    return image.toBuffer()
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

    it('should detect JPEG by magic bytes', async () => {
      const jpegBuffer = await createTestImage(100, 100, 'jpeg')
      expect(handler.canHandle(jpegBuffer)).toBe(true)
    })

    it('should detect PNG by magic bytes', async () => {
      const pngBuffer = await createTestImage(100, 100, 'png')
      expect(handler.canHandle(pngBuffer)).toBe(true)
    })
  })

  describe('Image Metadata Extraction', () => {
    it('should extract JPEG metadata', async () => {
      const imageBuffer = await createTestImage(800, 600, 'jpeg')

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
      expect(imageData.metadata.format).toBe('jpeg')
    })

    it('should extract PNG metadata', async () => {
      const imageBuffer = await createTestImage(400, 300, 'png')

      const result = await handler.process(imageBuffer, {
        extractEXIF: false
      })

      const imageData = result.data[0]
      expect(imageData.metadata.width).toBe(400)
      expect(imageData.metadata.height).toBe(300)
      expect(imageData.metadata.format).toBe('png')
      expect(imageData.metadata.hasAlpha).toBe(true)
    })

    it('should extract WebP metadata', async () => {
      const imageBuffer = await createTestImage(500, 500, 'webp')

      const result = await handler.process(imageBuffer, {
        extractEXIF: false
      })

      const imageData = result.data[0]
      expect(imageData.metadata.width).toBe(500)
      expect(imageData.metadata.height).toBe(500)
      expect(imageData.metadata.format).toBe('webp')
    })

    it('should include image size in bytes', async () => {
      const imageBuffer = await createTestImage(200, 200, 'jpeg')

      const result = await handler.process(imageBuffer)

      const imageData = result.data[0]
      expect(imageData.metadata.size).toBe(imageBuffer.length)
      expect(imageData.metadata.size).toBeGreaterThan(0)
    })

    it('should include color space and channels', async () => {
      const imageBuffer = await createTestImage(100, 100, 'jpeg')

      const result = await handler.process(imageBuffer, {
        extractEXIF: false
      })

      const imageData = result.data[0]
      expect(imageData.metadata.space).toBeDefined()
      expect(imageData.metadata.channels).toBeGreaterThan(0)
      expect(imageData.metadata.depth).toBeDefined()
    })

    it('should include processing time in metadata', async () => {
      const imageBuffer = await createTestImage(800, 600, 'jpeg')

      const result = await handler.process(imageBuffer)

      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0)
      expect(result.metadata.processingTime).toBeLessThan(5000)
    })

    it('should include image metadata in result metadata', async () => {
      const imageBuffer = await createTestImage(800, 600, 'jpeg')

      const result = await handler.process(imageBuffer)

      expect(result.metadata.imageMetadata).toBeDefined()
      expect(result.metadata.imageMetadata.width).toBe(800)
      expect(result.metadata.imageMetadata.height).toBe(600)
    })
  })

  describe('EXIF Data Extraction', () => {
    it('should handle images without EXIF data', async () => {
      const imageBuffer = await createTestImage(800, 600, 'jpeg')

      const result = await handler.process(imageBuffer, {
        extractEXIF: true
      })

      const imageData = result.data[0]
      // Should not crash, EXIF will be undefined
      expect(imageData.metadata.exif).toBeUndefined()
    })

    it('should extract EXIF by default', async () => {
      const imageBuffer = await createTestImage(800, 600, 'jpeg')

      // Default: EXIF extraction enabled
      const result = await handler.process(imageBuffer)

      // Will be undefined for test images, but should not crash
      expect(result.metadata.exifData).toBeUndefined()
    })

    it('should allow disabling EXIF extraction', async () => {
      const imageBuffer = await createTestImage(800, 600, 'jpeg')

      const result = await handler.process(imageBuffer, {
        extractEXIF: false
      })

      const imageData = result.data[0]
      expect(imageData.metadata.exif).toBeUndefined()
    })
  })

  describe('Error Handling', () => {
    it('should throw error for invalid image data', async () => {
      const invalidBuffer = Buffer.from('not an image', 'utf-8')

      await expect(handler.process(invalidBuffer)).rejects.toThrow('Image processing failed')
    })

    it('should throw error for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0)

      await expect(handler.process(emptyBuffer)).rejects.toThrow()
    })
  })

  describe('Format Support', () => {
    it('should process JPEG images', async () => {
      const imageBuffer = await createTestImage(200, 200, 'jpeg')

      const result = await handler.process(imageBuffer, {
        extractEXIF: false
      })

      expect(result.data[0].metadata.format).toBe('jpeg')
    })

    it('should process PNG images', async () => {
      const imageBuffer = await createTestImage(200, 200, 'png')

      const result = await handler.process(imageBuffer, {
        extractEXIF: false
      })

      expect(result.data[0].metadata.format).toBe('png')
    })

    it('should process WebP images', async () => {
      const imageBuffer = await createTestImage(200, 200, 'webp')

      const result = await handler.process(imageBuffer, {
        extractEXIF: false
      })

      expect(result.data[0].metadata.format).toBe('webp')
    })

    it('should handle various image dimensions', async () => {
      const sizes = [
        [100, 100],
        [1920, 1080],
        [400, 300],
        [1000, 500]
      ]

      for (const [width, height] of sizes) {
        const imageBuffer = await createTestImage(width, height, 'jpeg')
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
      const imageBuffer = await createTestImage(200, 200, 'jpeg')

      const result = await handler.process(imageBuffer)

      // Should match ProcessedData interface
      expect(result).toHaveProperty('format')
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('metadata')
      expect(result.format).toBe('image')
      expect(Array.isArray(result.data)).toBe(true)
    })
  })
})
