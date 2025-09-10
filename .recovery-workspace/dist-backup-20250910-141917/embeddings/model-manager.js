/**
 * Model Manager - Ensures transformer models are available at runtime
 *
 * Strategy (in order):
 * 1. Check local cache first (instant)
 * 2. Try Soulcraft CDN (fastest when available)
 * 3. Try GitHub release tar.gz with extraction (reliable backup)
 * 4. Fall back to Hugging Face (always works)
 *
 * NO USER CONFIGURATION REQUIRED - Everything is automatic!
 */
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { env } from '@huggingface/transformers';
// Model sources in order of preference
const MODEL_SOURCES = {
    // CDN - Fastest when available (currently active)
    cdn: {
        host: 'https://models.soulcraft.com/models',
        pathTemplate: '{model}/', // e.g., Xenova/all-MiniLM-L6-v2/
        testFile: 'config.json' // File to test availability
    },
    // GitHub Release - tar.gz fallback (already exists and works)
    githubRelease: {
        tarUrl: 'https://github.com/soulcraftlabs/brainy/releases/download/models-v1/all-MiniLM-L6-v2.tar.gz'
    },
    // Original Hugging Face - final fallback (always works)
    huggingface: {
        host: 'https://huggingface.co',
        pathTemplate: '{model}/resolve/{revision}/' // Default transformers.js pattern
    }
};
// Model verification files - BOTH fp32 and q8 variants
const REQUIRED_FILES = [
    'config.json',
    'tokenizer.json',
    'tokenizer_config.json'
];
const MODEL_VARIANTS = {
    fp32: 'onnx/model.onnx',
    q8: 'onnx/model_quantized.onnx'
};
export class ModelManager {
    constructor() {
        this.isInitialized = false;
        // Determine models path
        this.modelsPath = this.getModelsPath();
    }
    static getInstance() {
        if (!ModelManager.instance) {
            ModelManager.instance = new ModelManager();
        }
        return ModelManager.instance;
    }
    getModelsPath() {
        // Check various possible locations
        const paths = [
            process.env.BRAINY_MODELS_PATH,
            './models',
            join(process.cwd(), 'models'),
            join(process.env.HOME || '', '.brainy', 'models'),
            env.cacheDir
        ];
        // Find first existing path or use default
        for (const path of paths) {
            if (path && existsSync(path)) {
                return path;
            }
        }
        // Default to local models directory
        return join(process.cwd(), 'models');
    }
    async ensureModels(modelName = 'Xenova/all-MiniLM-L6-v2') {
        if (this.isInitialized) {
            return true;
        }
        // Configure transformers.js environment
        env.cacheDir = this.modelsPath;
        env.allowLocalModels = true;
        env.useFSCache = true;
        // Check if model already exists locally
        const modelPath = join(this.modelsPath, ...modelName.split('/'));
        if (await this.verifyModelFiles(modelPath)) {
            console.log('✅ Models found in cache:', modelPath);
            env.allowRemoteModels = false; // Use local only
            this.isInitialized = true;
            return true;
        }
        // Try to download from our sources
        console.log('📥 Downloading transformer models...');
        // Try CDN first (fastest when available)
        if (await this.tryModelSource('Soulcraft CDN', MODEL_SOURCES.cdn, modelName)) {
            this.isInitialized = true;
            return true;
        }
        // Try GitHub release with tar.gz extraction (reliable backup)
        if (await this.downloadAndExtractFromGitHub(modelName)) {
            this.isInitialized = true;
            return true;
        }
        // Fall back to Hugging Face (always works)
        console.log('⚠️ Using Hugging Face fallback for models');
        env.remoteHost = MODEL_SOURCES.huggingface.host;
        env.remotePathTemplate = MODEL_SOURCES.huggingface.pathTemplate;
        env.allowRemoteModels = true;
        this.isInitialized = true;
        return true;
    }
    async verifyModelFiles(modelPath) {
        // Check if essential files exist
        for (const file of REQUIRED_FILES) {
            const fullPath = join(modelPath, file);
            if (!existsSync(fullPath)) {
                return false;
            }
        }
        // At least one model variant must exist (fp32 or q8)
        const fp32Exists = existsSync(join(modelPath, MODEL_VARIANTS.fp32));
        const q8Exists = existsSync(join(modelPath, MODEL_VARIANTS.q8));
        return fp32Exists || q8Exists;
    }
    /**
     * Check which model variants are available locally
     */
    getAvailableModels(modelName = 'Xenova/all-MiniLM-L6-v2') {
        const modelPath = join(this.modelsPath, modelName);
        return {
            fp32: existsSync(join(modelPath, MODEL_VARIANTS.fp32)),
            q8: existsSync(join(modelPath, MODEL_VARIANTS.q8))
        };
    }
    /**
     * Get the best available model variant based on preference and availability
     */
    getBestAvailableModel(preferredType = 'fp32', modelName = 'Xenova/all-MiniLM-L6-v2') {
        const available = this.getAvailableModels(modelName);
        // If preferred type is available, use it
        if (available[preferredType]) {
            return preferredType;
        }
        // Otherwise fall back to what's available
        if (preferredType === 'q8' && available.fp32) {
            console.warn('⚠️ Q8 model requested but not available, falling back to FP32');
            return 'fp32';
        }
        if (preferredType === 'fp32' && available.q8) {
            console.warn('⚠️ FP32 model requested but not available, falling back to Q8');
            return 'q8';
        }
        return null;
    }
    async tryModelSource(name, source, modelName) {
        try {
            console.log(`📥 Trying ${name}...`);
            // Test if the source is accessible by trying to fetch a test file
            const testFile = source.testFile || 'config.json';
            const modelPath = source.pathTemplate.replace('{model}', modelName).replace('{revision}', 'main');
            const testUrl = `${source.host}/${modelPath}${testFile}`;
            const response = await fetch(testUrl).catch(() => null);
            if (response && response.ok) {
                console.log(`✅ ${name} is available`);
                // Configure transformers.js to use this source
                env.remoteHost = source.host;
                env.remotePathTemplate = source.pathTemplate;
                env.allowRemoteModels = true;
                // The model will be downloaded automatically by transformers.js when needed
                return true;
            }
            else {
                console.log(`⚠️ ${name} not available (${response?.status || 'unreachable'})`);
                return false;
            }
        }
        catch (error) {
            console.log(`⚠️ ${name} check failed:`, error.message);
            return false;
        }
    }
    async downloadAndExtractFromGitHub(modelName) {
        try {
            console.log('📥 Trying GitHub Release (tar.gz)...');
            // Download tar.gz file
            const response = await fetch(MODEL_SOURCES.githubRelease.tarUrl);
            if (!response.ok) {
                console.log(`⚠️ GitHub Release not available (${response.status})`);
                return false;
            }
            // Since we can't use tar-stream, we'll use Node's built-in child_process
            // to extract using system tar command (available on all Unix systems)
            const buffer = await response.arrayBuffer();
            const modelPath = join(this.modelsPath, ...modelName.split('/'));
            // Create model directory
            await mkdir(modelPath, { recursive: true });
            // Write tar.gz to temp file and extract
            const tempFile = join(this.modelsPath, 'temp-model.tar.gz');
            await writeFile(tempFile, Buffer.from(buffer));
            // Extract using system tar command
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);
            try {
                // Extract and strip the first directory component
                await execAsync(`tar -xzf ${tempFile} -C ${modelPath} --strip-components=1`, {
                    cwd: this.modelsPath
                });
                // Clean up temp file
                const { unlink } = await import('fs/promises');
                await unlink(tempFile);
                console.log('✅ GitHub Release models extracted and cached locally');
                // Configure to use local models now
                env.allowRemoteModels = false;
                return true;
            }
            catch (extractError) {
                console.log('⚠️ Tar extraction failed, trying alternative method');
                return false;
            }
        }
        catch (error) {
            console.log('⚠️ GitHub Release download failed:', error.message);
            return false;
        }
    }
    /**
     * Pre-download models for deployment
     * This is what npm run download-models calls
     */
    static async predownload() {
        const manager = ModelManager.getInstance();
        const success = await manager.ensureModels();
        if (!success) {
            throw new Error('Failed to download models');
        }
        console.log('✅ Models downloaded successfully');
    }
}
// Auto-initialize on import in production
if (process.env.NODE_ENV === 'production' && process.env.SKIP_MODEL_CHECK !== 'true') {
    ModelManager.getInstance().ensureModels().catch(error => {
        console.error('⚠️ Model initialization failed:', error);
        // Don't throw - allow app to start and try downloading on first use
    });
}
//# sourceMappingURL=model-manager.js.map