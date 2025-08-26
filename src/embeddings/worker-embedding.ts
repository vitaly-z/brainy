/**
 * Worker process for embeddings - Workaround for transformers.js memory leak
 * 
 * This worker can be killed and restarted to release memory completely.
 * Based on 2024 research: dispose() doesn't fully free memory in transformers.js
 */

import { TransformerEmbedding } from '../utils/embedding.js'
import { parentPort } from 'worker_threads'

let model: TransformerEmbedding | null = null
let requestCount = 0
const MAX_REQUESTS = 100 // Restart worker after 100 requests to prevent memory leak

async function initModel(): Promise<void> {
  if (!model) {
    model = new TransformerEmbedding({
      verbose: false,
      dtype: 'q8',
      localFilesOnly: process.env.BRAINY_ALLOW_REMOTE_MODELS !== 'true'
    })
    await model.init()
    console.log('🔧 Worker: Model initialized')
  }
}

if (parentPort) {
  parentPort.on('message', async (message) => {
    try {
      const { id, type, data } = message
      
      switch (type) {
        case 'embed':
          await initModel()
          const embeddings = await model!.embed(data)
          parentPort!.postMessage({ id, success: true, result: embeddings })
          
          requestCount++
          
          // Proactively restart worker to prevent memory leak
          if (requestCount >= MAX_REQUESTS) {
            console.log(`🔄 Worker: Restarting after ${requestCount} requests (memory leak prevention)`)
            process.exit(0) // Parent will restart us
          }
          break
          
        case 'dispose':
          if (model) {
            // This doesn't fully free memory (known issue), but try anyway
            if ('dispose' in model && typeof model.dispose === 'function') {
              model.dispose()
            }
            model = null
          }
          parentPort!.postMessage({ id, success: true })
          break
          
        case 'restart':
          // Force restart to clear memory
          console.log('🔄 Worker: Force restart requested')
          process.exit(0)
          break
          
        default:
          parentPort!.postMessage({ 
            id, 
            success: false, 
            error: `Unknown message type: ${type}` 
          })
      }
    } catch (error) {
      parentPort!.postMessage({ 
        id: message.id, 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      })
    }
  })

  console.log('🚀 Embedding worker started')
  parentPort.postMessage({ type: 'ready' })
} else {
  console.error('❌ Worker: parentPort is null, cannot communicate with main thread')
  process.exit(1)
}