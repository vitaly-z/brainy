/**
 * Local Augmentation Discovery
 *
 * Discovers augmentations installed locally in node_modules
 * and built-in augmentations that ship with Brainy
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
/**
 * Discovers augmentations installed locally
 */
export class LocalAugmentationDiscovery {
    constructor(options = {}) {
        this.options = options;
        this.builtInAugmentations = new Map();
        this.installedAugmentations = new Map();
        this.options = {
            brainyPath: this.options.brainyPath || this.findBrainyPath(),
            projectPath: this.options.projectPath || process.cwd(),
            scanNodeModules: this.options.scanNodeModules ?? true
        };
        // Register built-in augmentations
        this.registerBuiltIn();
    }
    /**
     * Register built-in augmentations that ship with Brainy
     */
    registerBuiltIn() {
        const builtIn = [
            { id: 'wal', name: 'Write-Ahead Log', path: 'walAugmentation' },
            { id: 'cache', name: 'Cache', path: 'cacheAugmentation' },
            { id: 'batch', name: 'Batch Processing', path: 'batchProcessingAugmentation' },
            { id: 'entity-registry', name: 'Entity Registry', path: 'entityRegistryAugmentation' },
            { id: 'index', name: 'Index', path: 'indexAugmentation' },
            { id: 'metrics', name: 'Metrics', path: 'metricsAugmentation' },
            { id: 'monitoring', name: 'Monitoring', path: 'monitoringAugmentation' },
            { id: 'connection-pool', name: 'Connection Pool', path: 'connectionPoolAugmentation' },
            { id: 'request-deduplicator', name: 'Request Deduplicator', path: 'requestDeduplicatorAugmentation' },
            { id: 'api-server', name: 'API Server', path: 'apiServerAugmentation' },
            { id: 'neural-import', name: 'Neural Import', path: 'neuralImport' },
            { id: 'intelligent-verb-scoring', name: 'Intelligent Verb Scoring', path: 'intelligentVerbScoringAugmentation' },
            { id: 'universal-display', name: 'Universal Display', path: 'universalDisplayAugmentation' },
            // Storage augmentations
            { id: 'memory-storage', name: 'Memory Storage', path: 'storageAugmentations', export: 'MemoryStorageAugmentation' },
            { id: 'filesystem-storage', name: 'FileSystem Storage', path: 'storageAugmentations', export: 'FileSystemStorageAugmentation' },
            { id: 'opfs-storage', name: 'OPFS Storage', path: 'storageAugmentations', export: 'OPFSStorageAugmentation' },
            { id: 's3-storage', name: 'S3 Storage', path: 'storageAugmentations', export: 'S3StorageAugmentation' },
        ];
        for (const aug of builtIn) {
            this.builtInAugmentations.set(aug.id, {
                id: aug.id,
                name: aug.name,
                source: 'builtin',
                path: `@soulcraft/brainy/augmentations/${aug.path}`,
                package: {
                    name: '@soulcraft/brainy',
                    version: 'builtin',
                    description: `Built-in ${aug.name} augmentation`
                }
            });
        }
    }
    /**
     * Find Brainy installation path
     */
    findBrainyPath() {
        // Try to find brainy in node_modules
        const possiblePaths = [
            join(process.cwd(), 'node_modules', '@soulcraft', 'brainy'),
            join(process.cwd(), 'node_modules', 'brainy'),
            join(process.cwd(), '..', 'node_modules', '@soulcraft', 'brainy'),
        ];
        for (const path of possiblePaths) {
            if (existsSync(path)) {
                return path;
            }
        }
        // Fallback to current directory
        return process.cwd();
    }
    /**
     * Discover all augmentations
     */
    async discoverAll() {
        const augmentations = [];
        // Add built-in augmentations
        augmentations.push(...this.builtInAugmentations.values());
        // Scan node_modules if enabled
        if (this.options.scanNodeModules) {
            const installed = await this.scanNodeModules();
            augmentations.push(...installed);
        }
        // Scan local project
        const local = await this.scanLocalProject();
        augmentations.push(...local);
        return augmentations;
    }
    /**
     * Scan node_modules for installed augmentations
     */
    async scanNodeModules() {
        const augmentations = [];
        const nodeModulesPath = join(this.options.projectPath, 'node_modules');
        if (!existsSync(nodeModulesPath)) {
            return augmentations;
        }
        // Scan @brainy/* packages
        const brainyPath = join(nodeModulesPath, '@brainy');
        if (existsSync(brainyPath)) {
            const packages = readdirSync(brainyPath);
            for (const pkg of packages) {
                const augmentation = await this.loadPackageAugmentation(join(brainyPath, pkg));
                if (augmentation) {
                    augmentations.push(augmentation);
                }
            }
        }
        // Scan packages with brainy-augmentation keyword
        const packages = readdirSync(nodeModulesPath);
        for (const pkg of packages) {
            if (pkg.startsWith('@') || pkg.startsWith('.'))
                continue;
            const pkgPath = join(nodeModulesPath, pkg);
            const packageJson = this.loadPackageJson(pkgPath);
            if (packageJson?.keywords?.includes('brainy-augmentation')) {
                const augmentation = await this.loadPackageAugmentation(pkgPath);
                if (augmentation) {
                    augmentations.push(augmentation);
                }
            }
        }
        return augmentations;
    }
    /**
     * Scan local project for augmentations
     */
    async scanLocalProject() {
        const augmentations = [];
        // Check for augmentations directory
        const augPath = join(this.options.projectPath, 'augmentations');
        if (existsSync(augPath)) {
            const files = readdirSync(augPath);
            for (const file of files) {
                if (file.endsWith('.ts') || file.endsWith('.js')) {
                    const name = file.replace(/\.(ts|js)$/, '');
                    augmentations.push({
                        id: name,
                        name: this.humanizeName(name),
                        source: 'local',
                        path: join(augPath, file)
                    });
                }
            }
        }
        return augmentations;
    }
    /**
     * Load augmentation from package
     */
    async loadPackageAugmentation(pkgPath) {
        const packageJson = this.loadPackageJson(pkgPath);
        if (!packageJson)
            return null;
        // Check if it's a brainy augmentation
        const isBrainyAug = packageJson.keywords?.includes('brainy-augmentation') ||
            packageJson.brainy?.type === 'augmentation';
        if (!isBrainyAug)
            return null;
        const manifest = packageJson.brainy?.manifest || null;
        return {
            id: packageJson.brainy?.id || packageJson.name.replace('@brainy/', ''),
            name: packageJson.brainy?.name || packageJson.name,
            source: 'npm',
            path: pkgPath,
            manifest,
            package: {
                name: packageJson.name,
                version: packageJson.version,
                description: packageJson.description
            }
        };
    }
    /**
     * Load package.json
     */
    loadPackageJson(pkgPath) {
        const packageJsonPath = join(pkgPath, 'package.json');
        if (!existsSync(packageJsonPath))
            return null;
        try {
            return JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        }
        catch {
            return null;
        }
    }
    /**
     * Convert name to human-readable format
     */
    humanizeName(name) {
        return name
            .replace(/[-_]/g, ' ')
            .replace(/augmentation/gi, '')
            .replace(/\b\w/g, l => l.toUpperCase())
            .trim();
    }
    /**
     * Get built-in augmentations
     */
    getBuiltIn() {
        return Array.from(this.builtInAugmentations.values());
    }
    /**
     * Get installed augmentations
     */
    getInstalled() {
        return Array.from(this.installedAugmentations.values());
    }
    /**
     * Check if augmentation is installed
     */
    isInstalled(id) {
        return this.builtInAugmentations.has(id) ||
            this.installedAugmentations.has(id);
    }
    /**
     * Get import path for augmentation
     */
    getImportPath(id) {
        const aug = this.builtInAugmentations.get(id) ||
            this.installedAugmentations.get(id);
        return aug?.path || null;
    }
    /**
     * Load augmentation module dynamically
     */
    async loadAugmentation(id) {
        const path = this.getImportPath(id);
        if (!path) {
            throw new Error(`Augmentation ${id} not found`);
        }
        // Dynamic import
        const module = await import(path);
        return module.default || module;
    }
}
//# sourceMappingURL=localDiscovery.js.map