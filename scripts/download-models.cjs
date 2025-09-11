#!/usr/bin/env node
/**
 * Download and bundle models for offline usage
 */

const fs = require('fs').promises
const path = require('path')

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2'
const OUTPUT_DIR = './models'

// Always download Q8 model only
const downloadType = 'q8'

async function downloadModels() {
  // Use dynamic import for ES modules in CommonJS
  const { pipeline, env } = await import('@huggingface/transformers')
  
  // Configure transformers.js to use local cache
  env.cacheDir = './models-cache'
  env.allowRemoteModels = true
  
  try {
    console.log('🧠 Brainy Model Downloader v2.8.0')
    console.log('===================================')
    console.log(`   Model: ${MODEL_NAME}`)
    console.log(`   Type: Q8 (optimized, 99% accuracy)`)
    console.log(`   Cache: ${env.cacheDir}`)
    console.log('')
    
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true })
    
    // Download Q8 model only
    console.log('📥 Downloading Q8 model (quantized, 33MB, 99% accuracy)...')
    await downloadModelVariant('q8')
    
    // Copy ALL model files from cache to our models directory
    console.log('📋 Copying model files to bundle directory...')
    
    const cacheDir = path.resolve(env.cacheDir)
    const outputDir = path.resolve(OUTPUT_DIR)
    
    console.log(`   From: ${cacheDir}`)
    console.log(`   To: ${outputDir}`)
    
    // Copy the entire cache directory structure to ensure we get ALL files
    // including tokenizer.json, config.json, and all ONNX model files
    const modelCacheDir = path.join(cacheDir, 'Xenova', 'all-MiniLM-L6-v2')
    
    if (await dirExists(modelCacheDir)) {
      const targetModelDir = path.join(outputDir, 'Xenova', 'all-MiniLM-L6-v2')
      console.log(`   Copying complete model: Xenova/all-MiniLM-L6-v2`)
      await copyDirectory(modelCacheDir, targetModelDir)
    } else {
      throw new Error(`Model cache directory not found: ${modelCacheDir}`)
    }
    
    console.log('✅ Model bundling complete!')
    console.log(`   Total size: ${await calculateDirectorySize(outputDir)} MB`)
    console.log(`   Location: ${outputDir}`)
    
    // Create a marker file with downloaded model info
    const markerData = {
      model: MODEL_NAME,
      bundledAt: new Date().toISOString(),
      version: '2.8.0',
      downloadType: downloadType,
      models: {}
    }
    
    // Check which models were downloaded
    const fp32Path = path.join(outputDir, 'Xenova/all-MiniLM-L6-v2/onnx/model.onnx')
    const q8Path = path.join(outputDir, 'Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx')
    
    if (await fileExists(fp32Path)) {
      const stats = await fs.stat(fp32Path)
      markerData.models.fp32 = {
        file: 'onnx/model.onnx',
        size: stats.size,
        sizeFormatted: `${Math.round(stats.size / (1024 * 1024))}MB`
      }
    }
    
    if (await fileExists(q8Path)) {
      const stats = await fs.stat(q8Path)
      markerData.models.q8 = {
        file: 'onnx/model_quantized.onnx', 
        size: stats.size,
        sizeFormatted: `${Math.round(stats.size / (1024 * 1024))}MB`
      }
    }
    
    await fs.writeFile(
      path.join(outputDir, '.brainy-models-bundled'),
      JSON.stringify(markerData, null, 2)
    )
    
    console.log('')
    console.log('✅ Download complete! Available models:')
    if (markerData.models.fp32) {
      console.log(`   • FP32: ${markerData.models.fp32.sizeFormatted} (full precision)`)
    }
    if (markerData.models.q8) {
      console.log(`   • Q8: ${markerData.models.q8.sizeFormatted} (quantized, 75% smaller)`)
    }
    console.log('')
    console.log('Air-gap deployment ready! 🚀')
    
  } catch (error) {
    console.error('❌ Error downloading models:', error)
    process.exit(1)
  }
}

// Download a specific model variant
async function downloadModelVariant(dtype) {
  const { pipeline } = await import('@huggingface/transformers')
  
  try {
    // Load the model to force download
    const extractor = await pipeline('feature-extraction', MODEL_NAME, {
      dtype: dtype,
      cache_dir: './models-cache'
    })
    
    // Test the model
    const testResult = await extractor(['Hello world!'], {
      pooling: 'mean', 
      normalize: true
    })
    
    console.log(`   ✅ ${dtype.toUpperCase()} model downloaded and tested (${testResult.data.length} dimensions)`)
    
    // Dispose to free memory
    if (extractor.dispose) {
      await extractor.dispose()
    }
    
  } catch (error) {
    console.error(`   ❌ Failed to download ${dtype} model:`, error)
    throw error
  }
}

async function findModelDirectories(baseDir, modelName) {
  const dirs = []
  
  try {
    // Convert model name to expected directory structure
    const modelPath = modelName.replace('/', '--')
    
    async function searchDirectory(currentDir) {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true })
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const fullPath = path.join(currentDir, entry.name)
            
            // Check if this directory contains model files
            if (entry.name.includes(modelPath) || entry.name === 'onnx') {
              const hasModelFiles = await containsModelFiles(fullPath)
              if (hasModelFiles) {
                dirs.push(fullPath)
              }
            }
            
            // Recursively search subdirectories
            await searchDirectory(fullPath)
          }
        }
      } catch (error) {
        // Ignore access errors
      }
    }
    
    await searchDirectory(baseDir)
  } catch (error) {
    console.warn('Warning: Error searching for model directories:', error)
  }
  
  return dirs
}

async function containsModelFiles(dir) {
  try {
    const files = await fs.readdir(dir)
    return files.some(file => 
      file.endsWith('.onnx') || 
      file.endsWith('.json') ||
      file === 'config.json' ||
      file === 'tokenizer.json'
    )
  } catch (error) {
    return false
  }
}

async function dirExists(dir) {
  try {
    const stats = await fs.stat(dir)
    return stats.isDirectory()
  } catch (error) {
    return false
  }
}

async function fileExists(file) {
  try {
    const stats = await fs.stat(file)
    return stats.isFile()
  } catch (error) {
    return false
  }
}

async function copyDirectory(src, dest) {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

async function calculateDirectorySize(dir) {
  let size = 0
  
  async function calculateSize(currentDir) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        
        if (entry.isDirectory()) {
          await calculateSize(fullPath)
        } else {
          const stats = await fs.stat(fullPath)
          size += stats.size
        }
      }
    } catch (error) {
      // Ignore access errors
    }
  }
  
  await calculateSize(dir)
  return Math.round(size / (1024 * 1024))
}

// Run the download
downloadModels().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})