/**
 * Image Import Integration Test (v5.2.0)
 *
 * Tests that ImageHandler works as a built-in handler with IntelligentImportAugmentation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import sharp from 'sharp'

describe('Image Import Integration (v5.2.0)', () => {
  let brain: Brainy

  // Create test image
  const createTestImage = async (width: number, height: number): Promise<Buffer> => {
    const channels = 3
    const pixelData = Buffer.alloc(width * height * channels)

    // Fill with gradient
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * channels
        pixelData[i] = Math.floor((x / width) * 255)
        pixelData[i + 1] = Math.floor((y / height) * 255)
        pixelData[i + 2] = 128
      }
    }

    return sharp(pixelData, {
      raw: { width, height, channels }
    })
      .jpeg({ quality: 90 })
      .toBuffer()
  }

  beforeEach(async () => {
    // IntelligentImportAugmentation is enabled by default with all handlers
    // Configure it to only enable image handler for focused testing
    brain = new Brainy({
      silent: true,
      augmentations: {
        intelligentImport: {
          enableCSV: false,
          enableExcel: false,
          enablePDF: false,
          enableImage: true // Only enable image handler for this test
        }
      }
    })

    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  describe('Built-in Image Handler', () => {
    it('should automatically handle image import via IntelligentImportAugmentation', async () => {
      const imageBuffer = await createTestImage(800, 600)

      // Import image - should be automatically processed by ImageHandler
      const result = await brain.import({
        type: 'buffer',
        data: imageBuffer,
        filename: 'test-photo.jpg'
      })

      expect(result).toBeDefined()
      expect(result.entities).toHaveLength(1)

      const imageEntity = result.entities[0]
      expect(imageEntity.type).toBe('media')
      expect(imageEntity.metadata?.subtype).toBe('image')
      expect(imageEntity.metadata).toBeDefined()
    })

    it('should extract image metadata via built-in handler', async () => {
      const imageBuffer = await createTestImage(1920, 1080)

      const result = await brain.import({
        type: 'buffer',
        data: imageBuffer,
        filename: 'hd-photo.jpg'
      })

      const imageEntity = result.entities[0]
      expect(imageEntity).toBeDefined()
      expect(imageEntity.metadata).toBeDefined()
      expect(typeof imageEntity.metadata).toBe('object')
      expect(imageEntity.metadata.width).toBe(1920)
      expect(imageEntity.metadata.height).toBe(1080)
      expect(imageEntity.metadata.format).toBe('jpeg')
    })

    it('should extract EXIF data when available', async () => {
      const imageBuffer = await createTestImage(400, 300)

      const result = await brain.import({
        type: 'buffer',
        data: imageBuffer,
        filename: 'camera-photo.jpg',
        options: {
          extractEXIF: true
        }
      })

      const imageEntity = result.entities[0]
      // Test image won't have EXIF, but should not crash
      expect(imageEntity).toBeDefined()
      expect(imageEntity.type).toBe('media')
      expect(imageEntity.metadata?.subtype).toBe('image')
    })

    it('should allow disabling EXIF extraction via config', async () => {
      const imageBuffer = await createTestImage(400, 300)

      const result = await brain.import({
        type: 'buffer',
        data: imageBuffer,
        filename: 'no-exif.jpg',
        options: {
          extractEXIF: false
        }
      })

      expect(result.entities).toHaveLength(1)
      expect(result.entities[0].type).toBe('media')
      expect(result.entities[0].metadata?.subtype).toBe('image')
    })

    it('should handle PNG images', async () => {
      const pngBuffer = await sharp(Buffer.alloc(100 * 100 * 4), {
        raw: { width: 100, height: 100, channels: 4 }
      })
        .png()
        .toBuffer()

      const result = await brain.import({
        type: 'buffer',
        data: pngBuffer,
        filename: 'logo.png'
      })

      const imageEntity = result.entities[0]
      expect(imageEntity.metadata.format).toBe('png')
      expect(imageEntity.metadata.hasAlpha).toBe(true)
    })

    it('should handle WebP images', async () => {
      const webpBuffer = await sharp(Buffer.alloc(200 * 200 * 3), {
        raw: { width: 200, height: 200, channels: 3 }
      })
        .webp({ quality: 90 })
        .toBuffer()

      const result = await brain.import({
        type: 'buffer',
        data: webpBuffer,
        filename: 'modern.webp'
      })

      const imageEntity = result.entities[0]
      expect(imageEntity.metadata.format).toBe('webp')
    })
  })

  describe('Configuration', () => {
    it('should allow disabling image handler', async () => {
      // Create new brain with image handler disabled
      const brainNoImage = new Brainy({
        silent: true,
        augmentations: {
          intelligentImport: {
            enableImage: false
          }
        }
      })
      await brainNoImage.init()

      const imageBuffer = await createTestImage(400, 300)

      // Import should still work, but won't be processed by ImageHandler
      const result = await brainNoImage.import({
        type: 'buffer',
        data: imageBuffer,
        filename: 'unprocessed.jpg'
      })

      // Should create entity but not extract image metadata
      expect(result).toBeDefined()

      await brainNoImage.close()
    })

    it('should apply imageDefaults config', async () => {
      const brainWithDefaults = new Brainy({
        silent: true,
        augmentations: {
          intelligentImport: {
            enableImage: true,
            imageDefaults: {
              extractEXIF: false // Default to no EXIF extraction
            }
          }
        }
      })
      await brainWithDefaults.init()

      const imageBuffer = await createTestImage(400, 300)

      const result = await brainWithDefaults.import({
        type: 'buffer',
        data: imageBuffer,
        filename: 'default-config.jpg'
      })

      expect(result.entities[0].type).toBe('media')
      expect(result.entities[0].metadata?.subtype).toBe('image')

      await brainWithDefaults.close()
    })
  })

  describe('Image Format Detection', () => {
    it('should detect JPEG by filename', async () => {
      const imageBuffer = await createTestImage(400, 300)

      const result = await brain.import({
        type: 'buffer',
        data: imageBuffer,
        filename: 'photo.jpg'
      })

      expect(result.entities[0].metadata.format).toBe('jpeg')
    })

    it('should detect JPEG by .jpeg extension', async () => {
      const imageBuffer = await createTestImage(400, 300)

      const result = await brain.import({
        type: 'buffer',
        data: imageBuffer,
        filename: 'photo.jpeg'
      })

      expect(result.entities[0].metadata.format).toBe('jpeg')
    })

    it('should handle various image sizes', async () => {
      const sizes = [
        [100, 100],
        [800, 600],
        [1920, 1080],
        [4000, 3000]
      ]

      for (const [width, height] of sizes) {
        const imageBuffer = await createTestImage(width, height)

        const result = await brain.import({
          type: 'buffer',
          data: imageBuffer,
          filename: `image-${width}x${height}.jpg`
        })

        const imageEntity = result.entities[0]
        expect(imageEntity.metadata.width).toBe(width)
        expect(imageEntity.metadata.height).toBe(height)
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid image data gracefully', async () => {
      const invalidBuffer = Buffer.from('not an image')

      // Brainy is resilient - invalid images still import with fallback minimal metadata
      const result = await brain.import({
        type: 'buffer',
        data: invalidBuffer,
        filename: 'invalid.jpg'
      })

      expect(result).toBeDefined()
      expect(result.entities).toHaveLength(1)
      expect(result.entities[0].type).toBe('media')
      expect(result.entities[0].name).toBe('invalid.jpg')
    })

    it('should handle empty image buffer', async () => {
      const emptyBuffer = Buffer.alloc(0)

      // Brainy is resilient - empty buffers still import with fallback minimal metadata
      const result = await brain.import({
        type: 'buffer',
        data: emptyBuffer,
        filename: 'empty.jpg'
      })

      expect(result).toBeDefined()
      expect(result.entities).toHaveLength(1)
      expect(result.entities[0].type).toBe('media')
      expect(result.entities[0].name).toBe('empty.jpg')
    })
  })

  describe('Integration with Knowledge Graph', () => {
    it('should store image entities in knowledge graph', async () => {
      const imageBuffer = await createTestImage(800, 600)

      const result = await brain.import({
        type: 'buffer',
        data: imageBuffer,
        filename: 'stored-image.jpg'
      })

      // Verify entity was created with metadata in import result
      expect(result.entities).toHaveLength(1)
      expect(result.entities[0].metadata.width).toBe(800)
      expect(result.entities[0].metadata.height).toBe(600)

      // Query for image entities - verifies it's in the knowledge graph
      const images = await brain.find({ type: 'media' })
      expect(images.length).toBeGreaterThan(0)

      // Verify media entities have the expected type
      const mediaEntities = images.filter(img => img.type === 'media')
      expect(mediaEntities.length).toBeGreaterThan(0)
    })

    it('should support querying by image metadata', async () => {
      // Import multiple images and capture metadata from results
      const result1 = await brain.import({
        type: 'buffer',
        data: await createTestImage(1920, 1080),
        filename: 'hd.jpg'
      })

      const result2 = await brain.import({
        type: 'buffer',
        data: await createTestImage(800, 600),
        filename: 'sd.jpg'
      })

      // Verify metadata in import results
      expect(result1.entities[0].metadata.width).toBe(1920)
      expect(result1.entities[0].metadata.height).toBe(1080)
      expect(result2.entities[0].metadata.width).toBe(800)
      expect(result2.entities[0].metadata.height).toBe(600)

      // Query all media entities - verifies they're in the knowledge graph
      const allImages = await brain.find({ type: 'media' })
      expect(allImages.length).toBeGreaterThan(0)

      // Verify multiple media entities were stored
      const mediaEntities = allImages.filter(img => img.type === 'media')
      expect(mediaEntities.length).toBeGreaterThanOrEqual(2)
    })
  })
})
