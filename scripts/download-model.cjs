#!/usr/bin/env node
/**
 * Download Model Assets
 *
 * Downloads the all-MiniLM-L6-v2 Q8 model from Hugging Face.
 * Run: node scripts/download-model.cjs
 */

const fs = require('node:fs')
const path = require('node:path')
const https = require('node:https')

const MODEL_DIR = path.join(__dirname, '..', 'assets', 'models', 'all-MiniLM-L6-v2-q8')
const BASE_URL = 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx'

const FILES = [
  {
    name: 'model_quantized.onnx',
    url: `${BASE_URL}/model_quantized.onnx`,
    dest: 'model.onnx',
  },
  {
    name: 'tokenizer.json',
    url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json',
    dest: 'tokenizer.json',
  },
  {
    name: 'config.json',
    url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/config.json',
    dest: 'config.json',
  },
  {
    name: 'vocab.txt',
    url: 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/vocab.txt',
    dest: 'vocab.txt',
  },
]

/**
 * Follow redirects and download file
 */
function downloadFile(url, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects === 0) {
      reject(new Error('Too many redirects'))
      return
    }

    const doRequest = (reqUrl) => {
      const parsedUrl = new URL(reqUrl)
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          'User-Agent': 'Brainy-Model-Downloader/1.0',
        },
      }

      https.get(options, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume() // Consume response data to free memory
          const redirectUrl = response.headers.location.startsWith('http')
            ? response.headers.location
            : new URL(response.headers.location, reqUrl).toString()
          console.log(`  ↳ Redirecting to: ${redirectUrl.slice(0, 80)}...`)
          downloadFile(redirectUrl, destPath, maxRedirects - 1)
            .then(resolve)
            .catch(reject)
          return
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }

        const fileStream = fs.createWriteStream(destPath)
        let downloadedBytes = 0
        const totalBytes = parseInt(response.headers['content-length'] || '0', 10)

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length
          if (totalBytes > 0) {
            const percent = Math.round((downloadedBytes / totalBytes) * 100)
            process.stdout.write(`\r  Progress: ${percent}% (${Math.round(downloadedBytes / 1024 / 1024)}MB)`)
          }
        })

        response.pipe(fileStream)

        fileStream.on('finish', () => {
          fileStream.close()
          console.log(`\n  ✅ Downloaded: ${path.basename(destPath)} (${Math.round(downloadedBytes / 1024 / 1024)}MB)`)
          resolve()
        })

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {}) // Delete partial file
          reject(err)
        })
      }).on('error', reject)
    }

    doRequest(url)
  })
}

/**
 * Convert vocab.txt to vocab.json
 */
function convertVocabToJson(vocabTxtPath, vocabJsonPath) {
  console.log('📝 Converting vocab.txt to vocab.json...')
  const content = fs.readFileSync(vocabTxtPath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())

  const vocab = {}
  for (let i = 0; i < lines.length; i++) {
    vocab[lines[i]] = i
  }

  fs.writeFileSync(vocabJsonPath, JSON.stringify(vocab))
  console.log(`  ✅ Created vocab.json with ${Object.keys(vocab).length} tokens`)

  // Remove vocab.txt since we have vocab.json
  fs.unlinkSync(vocabTxtPath)
}

async function main() {
  console.log('🔽 Downloading all-MiniLM-L6-v2 Q8 model assets...\n')

  // Create model directory
  fs.mkdirSync(MODEL_DIR, { recursive: true })
  console.log(`📁 Model directory: ${MODEL_DIR}\n`)

  // Download each file
  for (const file of FILES) {
    const destPath = path.join(MODEL_DIR, file.dest)

    // Check if already exists
    if (fs.existsSync(destPath)) {
      const stats = fs.statSync(destPath)
      if (stats.size > 0) {
        console.log(`⏭️  Skipping ${file.name} (already exists)`)
        continue
      }
    }

    console.log(`📥 Downloading ${file.name}...`)
    try {
      await downloadFile(file.url, destPath)
    } catch (error) {
      console.error(`  ❌ Failed to download ${file.name}: ${error.message}`)
      process.exit(1)
    }
  }

  // Convert vocab.txt to vocab.json
  const vocabTxtPath = path.join(MODEL_DIR, 'vocab.txt')
  const vocabJsonPath = path.join(MODEL_DIR, 'vocab.json')
  if (fs.existsSync(vocabTxtPath) && !fs.existsSync(vocabJsonPath)) {
    convertVocabToJson(vocabTxtPath, vocabJsonPath)
  }

  console.log('\n✅ All model assets downloaded successfully!')
  console.log('\nModel files:')
  const files = fs.readdirSync(MODEL_DIR)
  for (const file of files) {
    const stats = fs.statSync(path.join(MODEL_DIR, file))
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
    console.log(`  - ${file}: ${sizeMB}MB`)
  }
}

main().catch(console.error)
